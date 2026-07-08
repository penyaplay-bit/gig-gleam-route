
# Fare Deal Marketplace — v1 Plan

Big brief. Shipping a **functional vertical slice** first so the marketplace works end-to-end, then layering revenue features (boosts, subscriptions, escrow, commission tracking) in a follow-up. Existing `/request-quote` and admin Booking Command Centre stay untouched.

## v1 scope (this plan)

Roles, profiles, gig posting, browse/filter/apply, admin approval, notifications, status tracking.

## Deferred to v2 (called out, not built now)

Gig messaging thread, saved gigs, promoter negotiation UI, commission tracking dashboard, paid boosts, manager subscription tiers, artist verification fee, escrow. Tables for messaging/saved gigs will be created in v1 so the API surface is stable, but no UI.

---

## Roles & auth

- Extend `app_role` enum with `promoter`, `manager`, `artist` (keep existing `admin`, `staff`).
- `/auth` gets an "I am a…" selector on signup → creates the matching profile row + `user_roles` entry.
- Existing `_authenticated` gate stays admin/staff-only; new routes get their own role gates.

## New route map

| Route | Who | Purpose |
|---|---|---|
| `/find-gigs` | manager (auth) | Browse open, approved gigs. Filters + apply. |
| `/find-gigs/$id` | manager (auth) | Gig detail + application form. |
| `/my-applications` | manager | Track submitted applications. |
| `/post-gig` | promoter (auth) | Create a gig listing (goes to admin queue). |
| `/my-gigs` | promoter | List own gigs + view applications, shortlist, confirm. |
| `/my-gigs/$id` | promoter | Applications compare view. |
| `/admin/gigs` | admin/staff | Moderation queue: approve, reject, verify promoter. |
| `/admin/verify` | admin/staff | Verify managers & promoters. |

Existing `/request-quote` stays as the direct-quote path.

## Database (single migration)

Tables in `public`, each with proper GRANTs + RLS:

- **promoter_profiles** — `user_id`, `company_name`, `contact_name`, `phone`, `country`, `verified`, `verified_at`, `trust_score` (0–100, computed from verified + confirmed_bookings), `bio`.
- **manager_profiles** — `user_id`, `agency_name`, `contact_name`, `phone`, `country`, `verified`, `verified_at`, `bio`.
- **artist_rosters** — `manager_id` (→ manager_profiles), `artist_name`, `genre`, `artist_type` (dj/band/vocalist/etc), `base_city`, `bio`, `rate_hint_cents`, `active`. Manager's roster of representable artists (independent of internal `artists` table).
- **gigs** — `promoter_id`, `event_name`, `event_type`, `event_date`, `venue`, `city`, `country`, `crowd_size`, `budget_low_cents`, `budget_high_cents`, `currency`, `genre_needed[]`, `artist_type_needed[]`, `application_deadline`, `description`, `status` (`draft` / `pending_review` / `open` / `reviewing` / `shortlisted` / `booked` / `expired` / `rejected`), `admin_notes`, `approved_at`, `approved_by`, `booked_application_id` (nullable).
- **gig_applications** — `gig_id`, `manager_id`, `roster_artist_id`, `quote_cents`, `availability_notes`, `rider_notes`, `message`, `status` (`submitted` / `shortlisted` / `rejected` / `withdrawn` / `booked`), `created_at`, `updated_at`.
- **saved_gigs** — `manager_id`, `gig_id`, `saved_at`. UI in v2, table now for API stability.
- **gig_messages** — `gig_id`, `application_id`, `sender_user_id`, `body`, `created_at`. Schema only in v1.
- **gig_status_history** — `gig_id`, `from_status`, `to_status`, `changed_by`, `note`, `at`. Written by triggers on `gigs.status` change.

### RLS summary
- `gigs`: `anon` SELECT only where `status = 'open'` and `application_deadline >= today` (public browse works even signed-out for SEO); `manager` role SELECT same; promoter SELECT own; admin/staff full.
- `gig_applications`: manager SELECT/INSERT/UPDATE own; promoter SELECT applications on own gigs, UPDATE only `status` for shortlist/reject; admin full.
- `promoter_profiles` / `manager_profiles`: owner SELECT/UPDATE own, admin full, public SELECT of `verified`/`trust_score`/display name only via a view.
- `artist_rosters`: manager owns own; admin full.
- `saved_gigs`: manager owns.
- All timestamped tables get `updated_at` trigger via existing `set_updated_at()`.

### Status transitions (enforced by triggers)
- `draft` → `pending_review` (promoter submits)
- `pending_review` → `open` | `rejected` (admin)
- `open` → `reviewing` (first application) → `shortlisted` (promoter shortlists) → `booked` (promoter confirms)
- Any → `expired` (cron when deadline passes)

## Server functions (all `.functions.ts`, auth-gated)

- `src/lib/gigs/gigs.functions.ts` — `listOpenGigs(filters)`, `getGig(id)`, `createGig(input)`, `submitGigForReview(id)`, `updateGigStatus({id, status, note})` (promoter shortlist/book actions), `listMyGigs()`, `listMyApplications()`.
- `src/lib/gigs/applications.functions.ts` — `applyToGig(input)`, `withdrawApplication(id)`, `shortlistApplication(id)`, `bookApplication(id)` (moves gig → `booked`, notifies all applicants).
- `src/lib/gigs/roster.functions.ts` — CRUD for `artist_rosters`.
- `src/lib/gigs/admin.functions.ts` — `listPendingGigs()`, `approveGig(id)`, `rejectGig({id, reason})`, `verifyPromoter(id)`, `verifyManager(id)`, `convertToBooking(applicationId)` — creates a row in existing `bookings` table pre-filled from the gig + winning application, linking `admin.bookings.$id` workflow to the marketplace.
- **Public API**: `src/routes/api/public/gigs.ts` GET list (approved+open only, safe columns) so `/find-gigs` can SSR + share.

## UI (matches current cinematic dark theme)

- **Gig card** component: event name, city/country, date, crowd, budget range (never exact if promoter hides), genre tags, deadline countdown, promoter `verified` badge + trust score, status pill. Reuse existing shadcn tokens; ticket-card feel like `/request-quote`.
- **Find Gigs page**: hero + filter bar (date range, city, budget slider, genre multi-select, crowd size, verified-only toggle), responsive card grid, empty state.
- **Gig detail**: full description + apply form (pick roster artist, quote, availability, rider notes, message).
- **My Applications**: table with status chips.
- **Post Gig**: multi-section form; submit → `pending_review` with "Under review" screen.
- **My Gigs**: promoter dashboard, applications comparison table (quote/artist/manager verified/actions).
- **Admin gigs queue**: approve/reject with reason; "Convert to booking" button on `booked` gigs.

## Notifications

Reuse existing `notifications` table. Trigger inserts on: gig submitted (→ admin), gig approved (→ promoter), application received (→ promoter), shortlisted / booked / rejected (→ manager), gig expiring in 48h (→ promoter, via existing decision-engine cron).

## Signup

Extend `/auth` with a role picker chip group (Promoter / Manager / Artist). After signup:
- Insert into `user_roles`.
- Insert stub row in matching profile table.
- Redirect: promoter → `/my-gigs`, manager → `/find-gigs`, artist → landing (artist onboarding is v2).

## Explicitly NOT in v1

Messaging thread UI, saved gigs UI, negotiation flow, commission dashboard, paid boosts, manager subscription paywall, artist verification fee flow, escrow. All flagged in code with `TODO(v2)` where hooks exist.

## Order of build

1. Migration (all 8 tables + enum extension + RLS + triggers + history trigger).
2. Extend `/auth` with role picker + profile bootstrap.
3. Server fns: gigs, applications, roster, admin.
4. Public `/api/public/gigs` GET.
5. `/find-gigs` + detail + apply.
6. `/post-gig` + `/my-gigs` + comparison.
7. `/my-applications`.
8. `/admin/gigs` + `/admin/verify` + convert-to-booking wiring.
9. Add nav links to admin shell and public header.

## Technical notes

- Follows existing `_authenticated` pattern; add pathless `_manager`, `_promoter` layout gates under `_authenticated/` using `has_role`.
- Public `/find-gigs` is SSR-safe (uses public server fn with publishable-key client + narrow `TO anon` policy) so gigs are shareable/SEO-indexable.
- All money in cents, matches existing `bookings.quoted_amount` convention.
- Trust score derived: `verified ? 60 : 0` + `min(40, confirmed_bookings * 5)`.
- Convert-to-booking creates a `bookings` row with `ref = GIG-<yymmdd>-<rand>`, links back via `bookings.source_gig_id` (add column in same migration).

Ready to build on approval.
