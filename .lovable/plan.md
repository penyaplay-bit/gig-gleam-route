# Artist Intelligence Onboarding & Booking Calibration

Extends the existing engine — does not rebuild. Slots into the existing build order at **Slice 4.5** (Artist Career Mapping) and lays the data foundations that Slices 5–7.5 will read from. Nothing here changes concierge, feed, or existing gigs flows.

---

## What ships in this slice

A signed-in artist can complete a 5-step "Career Map" wizard, upload proof, get an auto-generated intelligence dashboard, and see their booking DNA improve match quality on the existing `/opportunities` feed.

Steps 9–15 in the spec depend on data this slice creates. They will be built in Slices 7 and 7.5 (feed reasons, morning brief, coach, learning weights). This plan explicitly marks which pieces land now vs later so we don't over-scope.

---

## 1. Database (single migration)

New tables, all RLS-locked to owner + service_role:

- **`artist_performances`** — one row per historical show
  - `id`, `owner_id`, `artist_id`, `event_name`, `venue_name`, `venue_address`, `city`, `province`, `country`, `event_date`, `start_time`, `end_time`, `crowd_est`, `headliner_bool`, `support_for` (text), `event_type` (enum: festival, club, corporate, wedding, government, private, university, tv, radio, brand, other), `fee_private` (int, nullable), `fee_currency`, `promoter_name`, `promoter_id` (nullable fk), `rating` (1–5, nullable), `notes_private`, `proof_urls` (text[]), `created_at`, `updated_at`
- **`artist_venues`** — dedupe cache: `id`, `name`, `city`, `country`, `lat`, `lng`, `created_by`
- **`artist_promoter_relations`** — rollup: `owner_id`, `promoter_name`, `promoter_id`, `booking_count`, `last_booked_at`, `avg_fee_private`, `strength_score`
- **`artist_market_signals`** — per (owner_id, city, country): `show_count`, `repeat_bookings`, `avg_crowd`, `last_show_at`, `season_json` (monthly histogram), `updated_at`
- **`artist_learning_events`** — append-only: `id`, `owner_id`, `kind` (pitch_sent, pitch_opened, pitch_replied, offer_received, accepted, declined, cancelled), `opportunity_id`, `meta_json`, `created_at`

Storage bucket **`performance-proofs`** (private) for posters, contracts, photos, videos (<50 MB per file). RLS on `storage.objects` scoped to owner.

Rollup function `public.refresh_artist_intel(_owner uuid)` (SECURITY DEFINER) recomputes `artist_market_signals` + `artist_promoter_relations` from `artist_performances`. Called on insert/update/delete of a performance via trigger, and nightly via pg_cron for all active owners.

Grants + policies follow the standard four-step pattern (CREATE → GRANT → ENABLE RLS → POLICY). Fee/notes columns stay owner-only; the scorer reads via service role during rollup, never via anon.

---

## 2. Server functions (`src/lib/intel/*.functions.ts`)

- `listPerformances`, `upsertPerformance`, `deletePerformance` — owner-scoped CRUD (`requireSupabaseAuth`).
- `searchVenues(q)`, `searchPromoters(q)` — typeahead against `artist_venues` + `promoters`.
- `uploadPerformanceProof` — signed URL into `performance-proofs`.
- `getIntelDashboard` — returns `{ timeline, topCities[], topCountries[], topVenues[], topPromoters[], topEventTypes[], seasonality, routes[], stats }` composed from `artist_market_signals` + `artist_promoter_relations` + raw performances.
- `getRouteSuggestions(intentId)` — Step 7: identifies touring corridors from historical clusters (city pairs within 500 km performed within 7 days).

All read-heavy dashboard calls memoize a `?since=updated_at` cursor so we don't recompute on every page load.

---

## 3. Onboarding wizard (`/artist/intelligence/onboarding`)

New route under `_signedin/`. 5 steps mapped to the spec:

1. **Profile top-up** — reads existing `artist_owner_profiles`; only asks for fields still empty (booking contact, riders, socials, media kit).
2. **Territory** — pulls from `booking_intents` if concierge is done; otherwise primary + additional (Step 10). Writes back to `booking_intents`.
3. **Performance history** — repeatable form. Search-or-create for venue/promoter/city. Bulk "Add another" + CSV paste fallback for artists with long histories. File uploads deferred but supported.
4. **Review & confirm** — shows count, oldest/newest show, "we found N repeat venues".
5. **Career map preview** — renders the dashboard (below) inline as the completion screen.

Optional, with the nudge copy from the earlier plan ("You'll get better matches"). A dismissible banner on `/artist` links back until at least 3 performances exist.

---

## 4. Intelligence dashboard (`/artist/intelligence`)

Single page, sections match spec Steps 3–8:

- **Career timeline** — vertical timeline grouped by year.
- **Fanbase heat map** — table of top cities (rank, show count, last show, avg crowd). Map view deferred; table ships now.
- **Venue intelligence** — cards with relationship score, last booked, repeat count.
- **Promoter intelligence** — same shape for promoters.
- **Route intelligence** — detected corridors (from `getRouteSuggestions`) with a "prioritize nearby opportunities" toggle that writes `booking_intents.filters_json.prefer_corridors = true`.
- **Calendar calibration** — monthly histogram (busy/free months). Historical dates do NOT block future bookings; a note explains that.

Empty states point back to onboarding.

---

## 5. Match engine hook-in (minimal now, full in Slice 7.5)

Extend the existing (or stub) scorer signature to `matchScore(artist, opp, availability, intel) → { score, subscores, reasons[] }`. `intel` is the artist's `artist_market_signals` + `artist_promoter_relations`. New reason strings surface in the feed:

- "You've performed in {city} {N} times"
- "You've booked with {promoter} {N} times"
- "Fits your {month} touring pattern"
- "Efficient routing from {recentCity}"

Actual re-ranking weights land in Slice 7.5's Smart Learning; this slice just wires the data through so reasons appear on Verified + Discovered cards.

---

## 6. What is explicitly deferred

- **AI Career Coach** copy generation (Step 15) — Slice 7 (`ai_briefs` already exists).
- **Morning brief page** (Step 11) — Slice 7.
- **Smart Outreach / Pitch My Artist** (Steps 12–13) — Slice 6 as previously planned.
- **Learning weight tuning** (Step 14) — Slice 7.5 once we have signal volume.
- Real geocoding for the heat map — table view now, `mapbox`/`maplibre` layer later.

---

## Technical section

- Migration: one file, adds enums (`performance_event_type`), tables above, `refresh_artist_intel` function, trigger on `artist_performances`, storage bucket via `supabase--storage_create_bucket`, storage.objects RLS.
- Server fns live in `src/lib/intel/*.functions.ts`; a `.server.ts` sibling holds the rollup helpers so `supabaseAdmin` never imports at module scope of the functions file.
- pg_cron: nightly `SELECT public.refresh_artist_intel(owner_id) FROM booking_intents WHERE active` via `/api/public/cron/rollup-intel` (apikey auth).
- Route files: `src/routes/_signedin/artist.intelligence.tsx`, `src/routes/_signedin/artist.intelligence.onboarding.tsx`. Both use `useSuspenseQuery` + loader `ensureQueryData` pattern.
- Wizard is a client component (form-heavy); server fns handle persistence per step so a refresh doesn't lose progress.
- Types regenerate after migration approval; wizard + dashboard code lands after that.
- No changes to `find-gigs`, `concierge`, admin, or existing gigs flows.

---

## Open questions (defaults in brackets — say "defaults" and I'll pick)

1. **Wizard placement** — nudge from `/artist` dashboard only, or interstitial after first sign-in? [dashboard nudge, dismissible]
2. **CSV bulk import** for performance history — ship now or Slice 7.5? [ship now, simple paste-parse, no file upload]
3. **Fee privacy default** — private per-row with owner toggle, or always private? [always private; artist toggles per-field visibility later in profile settings]
4. **Proof uploads in v1** — enable full upload UI, or store URLs only and add uploader in a follow-up? [URLs only now, uploader in a small follow-up so this slice ships fast]
