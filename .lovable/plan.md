# Penya Play Bookings Intelligence Engine

Replace the flat `/find-gigs` list with a modular AI booking OS: a concierge that profiles intent, a discovery engine that ingests opportunities from public sources, a match engine that scores fit, an outreach assistant, a pipeline CRM, watchlists, and a daily brief.

## Architecture — six independent modules over shared services

```text
┌─────────────────────────────────────────────────────────┐
│  UI: Concierge · Feed · Pipeline · Watchlists · Brief   │
├─────────────────────────────────────────────────────────┤
│  Match Engine   │  Outreach   │  Recommender │  CRM     │
├─────────────────────────────────────────────────────────┤
│  Discovery Engine (sources → normalize → dedupe)        │
├─────────────────────────────────────────────────────────┤
│  Shared services: Artists · Availability · Promoters ·  │
│  Scoring · AI Gateway · Notifications · Analytics       │
└─────────────────────────────────────────────────────────┘
```

Every module is a folder under `src/lib/engine/*` with a thin public API. Marketplace-specific branding, taxonomies, and copy live in a `tenant` config so the engine can be re-skinned later without a rewrite.

## Data model (new tables, Lovable Cloud)

- `opportunities` — normalized event (title, org, venue, city, country, start_date, category, budget_est, audience_est, capacity, deadline, source, source_url, dedupe_hash, trust_score, estimates_json, status)
- `opportunity_sources` — registered source (name, kind, url, parser, cadence, enabled)
- `opportunity_ingest_runs` — one row per crawl (source_id, started_at, finished_at, found, new, errors)
- `promoter_intel` — public-only promoter profile (company, website, venue, public_email, public_phone, socials_json, prior_events_json, genres, scale, verified)
- `booking_intents` — concierge output per artist (roles, categories[], fee_min, fee_currency, geo_scope, travel_ok, filters_json)
- `watchlists` — saved search (owner_id, artist_id, name, criteria_json, cadence, channels[])
- `match_scores` — artist × opportunity fit cache (score, subscores_json, reasons_json, computed_at)
- `booking_deals` — pipeline row (artist_id, opportunity_id, stage, owner_id, last_activity_at, value_est)
- `deal_events` — pipeline history (deal_id, kind, payload_json, actor_id)
- `outreach_messages` — proposal drafts + tracking (deal_id, subject, body, status: draft/sent/opened/replied/…)
- `ai_briefs` — cached daily brief per artist (date, summary_json)

All with RLS + GRANTs per Cloud rules. `opportunities` and `promoter_intel` are readable by any authenticated user; write via service role from ingest jobs. Everything with `owner_id` scopes to `auth.uid()`.

## Routes

- `/concierge` — 6-step chat wizard, writes to `booking_intents`
- `/opportunities` — AI feed (replaces `/find-gigs` list view; `/find-gigs/$id` kept as detail)
- `/opportunities/$id` — detail + match explanation + "Pitch artist"
- `/watchlists` — list + create/edit
- `/pipeline` — kanban across the 13 pipeline stages
- `/brief` — daily AI brief (also embedded on dashboard)
- `/promoters/$id` — public promoter intel page
- Owner: `/_signedin/artist/availability` — calendar editor

## AI surfaces (Lovable AI, `google/gemini-3-flash-preview`)

- Concierge conversation → structured `booking_intents` via `Output.object`
- Match reasons (why this fits) → short natural-language rationale
- Pitch generator → editable proposal from artist profile + opportunity
- Daily brief → grouped, prioritized summary

All AI calls in `createServerFn` with Zod schemas. No schema bounds — clamp in code.

## Discovery engine

- Server route `/api/public/cron/discover` (CRON_SECRET-guarded) runs per source
- Per-source parser modules under `src/lib/engine/discovery/sources/*.ts` returning a normalized `RawOpportunity`
- Normalizer + dedupe by `dedupe_hash = sha256(title|date|venue|city)`
- Missing fields estimated by AI, stored in `estimates_json` with a `confidence` and flagged in UI
- pg_cron hits the endpoint hourly for fast sources, nightly for slow ones
- v1 sources: 3 seed parsers (one ticketing site, one municipality calendar, one university events page) + a manual `POST /api/opportunities` for admin entry. More sources are added as parser files without schema changes.

## Match engine (`src/lib/engine/match/score.ts`)

Pure function `matchScore(artist, opportunity, availability) → { score, subscores, reasons[], checks }`. Sub-scores: Genre, Budget, Location, Audience, Availability, Past Performance, Trust. Recomputed on opportunity insert, artist profile change, and nightly. Cached in `match_scores`.

## Concierge flow (6 steps as specified)

1. Who — self / roster picker (manager sees artist cards with fee, availability, trust, reach)
2. Booking types — multi-select from the 14 listed categories
3. Fee — quick ranges + custom + min acceptable + currency
4. Location — geo scope radio + "travel if covered" toggle
5. Availability — month calendar with Available/Busy/On Tour/Tentative/Blocked + recurring rules
6. Preferences — filter chips (Paid Only, Sponsored, VIP, etc.)

Output writes `booking_intents` and immediately renders a ranked feed.

## Outreach

"Pitch Artist" on any opportunity opens an editable proposal (artist profile, awards, reach, streaming, history, media kit, fee, availability, why-match). Send creates `outreach_messages` row and a `booking_deals` row at stage "Proposal Sent". Open/reply tracking via a tracking pixel + reply-to alias (v2 — v1 is manual stage advance).

## Pipeline

Kanban across 13 stages: Discovered → Qualified → Contact Available → Proposal Prepared → Proposal Sent → Opened → Interested → Negotiating → Contract Sent → Deposit Paid → Booked → Completed → Review Collected. Drag to advance; every move writes `deal_events`.

## Watchlists

Saved search (`criteria_json` = subset of intent shape). Nightly job diffs each watchlist against new opportunities and enqueues notifications (email/push/in-app) per user preference and cadence.

## Daily brief

Nightly cron composes per-artist brief: counts by category, top N ranked opportunities with reasons, urgent-deadline callouts, projected value. Rendered on `/brief` and the dashboard.

## Build order (7 slices, ship incrementally)

1. **Schema + tenant config** — all tables + RLS/GRANTs + `src/lib/engine/tenant.ts` (branding, taxonomies, geo scopes)
2. **Concierge wizard** — `/concierge`, writes `booking_intents`, replaces the empty-state on `/find-gigs`
3. **Match engine + ranked feed** — `matchScore` + `/opportunities` list + `/opportunities/$id` with reasons
4. **Discovery v1** — 3 seed parsers + admin manual entry + hourly cron + dedupe
5. **Watchlists + notifications** — saved searches, nightly diff, in-app + email digest
6. **Pipeline CRM + outreach** — deals kanban, pitch generator, message tracking (manual stage advance in v1)
7. **Daily brief + promoter intel pages** — `/brief` + `/promoters/$id`

## Out of scope for v1

- Automated email open/reply tracking (added in slice 6.5)
- Scraping paid/ToS-restricted sources — only public data, respect robots.txt
- Contract e-sign and deposits (already exist as separate flows)
- Reusing engine in a second marketplace (architecture supports it; not shipped)

## Technical section

- Cloudflare Workers runtime: parsers use `fetch` + `linkedom`/regex, never `puppeteer`/`sharp`/`child_process`
- All ingest and scoring in `createServerFn` or `/api/public/cron/*` routes, service-role writes via dynamic import
- AI: `Output.object` with tiny schemas, `NoObjectGeneratedError` fallback to parsed text
- Kanban: `dnd-kit`, optimistic updates via TanStack Query
- Calendar editor: existing shadcn `Calendar` + `pointer-events-auto`

## Open questions (please answer before I start)

1. **Discovery sources for v1** — pick 3 to seed: (a) Computicket/Webtickets style ticketing, (b) a Lesotho/SA municipality events page, (c) NUL/UFS/Wits university events, or name your own 3?
2. **Concierge for managers** — should the wizard run once per artist on the roster, or a single intent that applies to all roster artists?
3. **Notifications channels for v1** — in-app only, or in-app + email from day one? (Push needs native app work.)
4. **Pipeline ownership** — one shared pipeline per manager across all their artists, or one pipeline per artist?

Say "go with defaults" and I'll pick: (1) municipality + one ticketing + one university, (2) per-artist intent, (3) in-app + email, (4) per-artist pipeline with a roster-wide overview.
