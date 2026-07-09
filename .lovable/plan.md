# Penya Play Bookings Engine — Revised Spec

Rewriting the plan around two principles you added:
1. **Never invent budgets.** Verified vs Discovered is a first-class distinction.
2. **The engine learns.** Every performance, pitch, and booking feeds an Artist Intelligence layer that improves recommendations over time.

Slice 1 (schema + tenant config) is already live. This plan revises slices 2–7 and adds two new slices.

---

## 1. Opportunity Types — schema changes

Add to `opportunities`:
- `kind` enum: `verified` | `discovered`
- `verified_promoter_id` (nullable, FK to `promoters`)
- `public_website`, `public_organizer`, `public_socials_json`, `ticketing_url`
- Keep `budget_est` / `estimates_json` — but the UI **only** reads them when `kind = 'verified'` AND the field was supplied by the promoter. Discovered rows never render a fee.
- `attendance_public` (nullable int) — only shown if the organizer published it

Verified opportunities come from:
- Promoters posting via the existing gig flow (migrate `gigs` → `opportunities` with `kind='verified'`)
- Admin manual entry

Discovered opportunities come from the Discovery Engine (public sources only).

---

## 2. UI — two distinct cards

**Verified card** (green ✅ badge)
- Full detail: fee, requirements, deadline, promoter Trust Score
- CTA: **Apply**

**Discovered card** (blue 🔍 badge)
- Public info only + `"Budget not publicly available."`
- CTA: **Pitch My Artist** (opens AI outreach), **View Event** (public URL), **Save**
- Match block explains *why* in plain language, not just a %

Both cards live in the same `/opportunities` feed with a filter chip.

---

## 3. Territory Search (replaces the old "Geo Scope" step)

Concierge step 4 becomes:
- **Primary Territory** — single-select country (Lesotho, South Africa, Botswana, Namibia, Zambia, Zimbabwe, +more)
- **Additional Territories** — multi-select
- Optional: cities/provinces inside the primary territory
- Toggle: "Travel if covered"

Feed ranking multiplies match score by a territory weight (primary = 1.0, additional = 0.7, outside = 0 unless travel_ok).

---

## 4. AI Booking Outreach ("Pitch My Artist")

Server fn assembles a proposal from:
- Artist profile, awards, monthly listeners, socials, media kit
- Rate card, technical rider, availability
- **Personalized cover letter** — Lovable AI (`google/gemini-3-flash-preview`) explains fit using the same reasons the match engine surfaced

Artist/manager edits before send. Send creates `outreach_messages` + a `booking_deals` row at "Proposal Sent".

For discovered events with no contact, the proposal is queued as "Contact Needed" — admin/AI hunts a public contact, or the artist can copy/paste the message elsewhere.

---

## 5. Artist Intelligence Engine (NEW — slices 4.5 & 7.5)

### New tables

- `artist_performances` — career history (venue, city, country, date, event_type, crowd_est, headliner_bool, fee_private, promoter, rating, proof_urls[]). Feeds Venue Intelligence + Fanbase Heat Map. Private by default; artist controls visibility.
- `artist_market_signals` — cached per (artist, city|region): show_count, repeat_bookings, streaming_index, social_index, saves, inquiries, last_updated
- `artist_learning_events` — every pitch/open/reply/accept/decline/cancel, timestamped, for the recommender

### Onboarding — "Where have you performed?"
New step in artist onboarding: search existing venues/events or add custom, capture the fields above. Uploads (posters, contracts) go to storage and can be surfaced to the verifier.

### Venue Intelligence + Fanbase Heat Map
`/artist/intelligence` page:
- Top markets (city + show count)
- Repeat promoters
- Best-converting event types
- Heat map of demand by city (aggregated signals)

### Opportunity Score with reasons
Match engine returns not just a number but a `reasons[]` array:
> "96% Booking Probability — You've performed in Johannesburg 21 times · The organizer books Amapiano · Your audience overlaps · You're available · Your fee fits event scale"

### AI Career Advisor (on `/brief`)
Nightly job composes advisory prompts from `artist_market_signals` diffs:
> "Streaming in Durban up 38% — consider KZN events"
> "6 uni shows, 100% repeat rate — 4 similar opportunities this semester"

### Smart Learning
`artist_learning_events` feeds weights into the scorer: promoter response rate, accepted fee ranges, converting cities, seasonal patterns.

### Privacy
- Fees and contracts private by default
- Artist toggles per-field visibility
- AI uses private data internally to score, but never surfaces it to other users

---

## 6. Revised Build Order

| # | Slice | Status |
|---|-------|--------|
| 1 | Schema + tenant config | ✅ done |
| 2 | Concierge wizard + Territory search + `booking_intents` | next |
| 3 | Match engine (with reasons) + `/opportunities` feed with Verified/Discovered cards | |
| 4 | Discovery Engine v1 (3 public-source parsers, no budget invention) + admin manual entry | |
| **4.5** | **Artist Career Mapping onboarding + `artist_performances` table** | new |
| 5 | Watchlists + notifications (in-app + email) | |
| 6 | Pipeline CRM + Pitch My Artist outreach | |
| 7 | Daily brief + promoter intel pages | |
| **7.5** | **Artist Intelligence dashboard (Venue Intelligence, Heat Map, Career Advisor) + Smart Learning weights** | new |

Ship each slice end-to-end before starting the next.

---

## Technical section

- New enum `opportunity_kind` (`verified` | `discovered`); migrate existing rows to `verified`.
- Discovery parsers under `src/lib/engine/discovery/sources/*.ts`; each returns `RawOpportunity` with `kind='discovered'` and never sets `budget_est`.
- Territory: reuse existing `africa-locations.ts`; add `booking_intents.primary_territory` (text) + `additional_territories` (text[]).
- Match score signature becomes `matchScore(artist, opportunity, availability, intel) → { score, subscores, reasons[] }` where `intel` is `artist_market_signals`.
- Career Advisor: `createServerFn` with Lovable AI `Output.object`, cached in `ai_briefs`.
- Learning events: single append-only table, nightly rollup into `artist_market_signals` (pg_cron → `/api/public/cron/rollup-intel`).
- Privacy: `artist_performances.fee_private`, `.notes_private` are hidden by RLS from anyone except owner + service role; the scorer reads via service role during rollup.
- Cloudflare Workers-safe: `fetch` + `linkedom`, no puppeteer/sharp.

---

## Questions before I build slice 2

1. **Primary territory default** — Lesotho, or read from artist profile country?
2. **Career mapping** — mandatory in onboarding, or optional with a "You'll get better matches" prompt?
3. **Pitch My Artist for verified events** — always show it as a secondary CTA alongside Apply, or only on Discovered?
4. **Discovered → Verified promotion** — if a discovered event's organizer later signs up and claims it, do we merge the row (keeping history) or replace?

Say "defaults" and I'll pick: (1) profile country → Lesotho fallback, (2) optional with nudge, (3) Discovered only, (4) merge and keep history.
