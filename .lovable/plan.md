# Two-Sided Gig Marketplace — Implementation Plan

Build the manager-facing `/find-gigs` marketplace on top of the existing app without touching `/request-quote`, the Booking Command Centre, or current auth. Cinematic dark premium UI with glassmorphism.

## 1. Database (single migration)

Extend `app_role` enum with `promoter`, `manager`, `artist` (keep `admin`, `staff`).

Create 8 tables with RLS + GRANTs:

- **promoter_profiles** — user_id, company, bio, website, trust_score (int), verified (bool), confirmed_bookings (int)
- **manager_profiles** — user_id, agency, bio, phone, verified (bool), subscription_tier
- **artist_rosters** — manager_id, artist_name, genre, artist_type, base_fee, bio, image_url, tech_rider_url
- **gigs** — promoter_id, title, description, event_date, location, city, crowd_size, budget_min, budget_max, genre, artist_type, application_deadline, status (`pending|open|reviewing|shortlisted|booked|expired|rejected`), admin_approved, boosted, source (`request_quote|post_gig`), linked_booking_id
- **gig_applications** — gig_id, manager_id, artist_id (roster), quote_amount, rider_notes, availability_confirmed, message, status (`submitted|shortlisted|negotiating|accepted|rejected|withdrawn`)
- **saved_gigs** — manager_id, gig_id (unique)
- **gig_messages** — gig_id, application_id, sender_id, body
- **gig_status_history** — gig_id, from_status, to_status, changed_by (auto-logged via existing `log_gig_status_change` trigger)

RLS highlights:
- `gigs` SELECT for `anon` **only** where `status='open' AND admin_approved AND application_deadline >= today` (SEO/public)
- `gigs` full CRUD for owning promoter; admin full access
- `gig_applications` visible to owning manager, gig's promoter, and admin
- `manager_profiles`/`promoter_profiles` public read of safe columns; owner + admin write
- `saved_gigs`, `artist_rosters` owner-scoped

Trust score formula (computed on read via view or on write):
`trust_score = (verified ? 60 : 0) + LEAST(40, confirmed_bookings * 5)`

Seed data: 2 verified promoters, 2 verified managers with 3-artist rosters each, 6 approved open gigs across genres/cities, 4 sample applications in mixed statuses.

## 2. Auth extension

Extend `/auth` with a role picker (Promoter / Manager / Artist) on signup:
- Inserts into `user_roles`
- Creates stub `promoter_profiles` or `manager_profiles` row
- Post-signup redirect: manager → `/find-gigs`, promoter → `/my-gigs`, artist → landing

Existing sign-in and admin/staff roles untouched.

## 3. Server functions (`createServerFn` + `requireSupabaseAuth`)

- `src/lib/gigs.functions.ts` — `listPublicGigs` (filters), `getGig`, `createGig`, `updateGigStatus`
- `src/lib/applications.functions.ts` — `applyToGig`, `listMyApplications`, `listGigApplications` (promoter), `shortlistApplication`, `acceptApplication` → sets gig `booked`, creates `bookings` row, links `linked_booking_id`
- `src/lib/roster.functions.ts` — CRUD for artist_rosters
- `src/lib/saved-gigs.functions.ts` — save/unsave/list
- `src/lib/gig-admin.functions.ts` — approve/reject gig, verify promoter/manager, moderation
- All state changes insert into `notifications`

## 4. Public API route

`src/routes/api/public/gigs.ts` — GET list of approved open gigs (safe columns only) for SSR and share links. Uses server publishable client + narrow `TO anon` policy.

## 5. Routes (all cinematic dark + glassmorphism)

**Public / manager**
- `/find-gigs` — browse grid, filter sidebar (date / city / budget slider / genre / crowd size), save toggle, gig cards with all required fields + trust score + verified badge + status pill
- `/find-gigs/$id` — gig detail + apply drawer (artist picker from roster, quote, rider, availability, message)
- `/my-applications` — manager's applications with status tracking
- `/roster` — manager manages artist roster

**Promoter**
- `/post-gig` — create gig (enters `pending` awaiting admin approval)
- `/my-gigs` — list own gigs
- `/my-gigs/$id` — see applications, compare quotes side-by-side, shortlist, negotiate, confirm booking

**Admin**
- `/admin/gigs` — approve/reject queue, moderation, convert-to-booking control
- `/admin/verify` — verify promoters/managers, view trust scores

All new routes under `_authenticated/` except `/find-gigs` (public browse, apply requires auth).

## 6. UI system

Reuse existing tokens in `src/styles.css`. New shared components:
- `GigCard` — glass surface, gradient border on hover, status pill, verified checkmark, trust score chip
- `GigFilters` — sticky sidebar / mobile drawer
- `ApplicationDrawer` — slide-over with roster picker
- `StatusPill` — semantic color per status
- `TrustBadge` — score + verified icon

Mobile: filters collapse to sheet, cards single column, drawer becomes fullscreen.

## 7. Out of scope for this pass (scaffolded, flagged `TODO(v2)`)

Messaging thread UI, paid boosts checkout, manager subscription checkout, artist verification fee, escrow, commission dashboard. Schema supports them; UI ships in a follow-up.

## Build order

1. Migration + seed
2. Extend `/auth` role picker
3. Server functions + public API
4. `/find-gigs` + detail + apply
5. `/roster`, `/my-applications`
6. `/post-gig`, `/my-gigs`, `/my-gigs/$id`
7. `/admin/gigs`, `/admin/verify`
8. Verify nothing on `/request-quote`, Booking Command Centre, or existing auth changed
