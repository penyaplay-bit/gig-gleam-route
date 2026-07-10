# Penya Play — Master Vision Rollout Plan

This is an evolution of the existing app, not a rebuild. All current auth, Supabase schema, bookings, roles, gigs, intelligence engine, concierge, wallet-adjacent tables, APIs and messaging stay intact. Work is sliced so each slice ships value on its own.

## Guiding principles
- Universal roles: replace "Artist / Promoter" split with multi-role account (`I want to get booked / hire talent / list a venue / organize events / provide services / manage talent / represent a brand`). Existing `user_roles` stays; add a `profile_intents` layer.
- Never invent budgets. Keep the Verified vs Public opportunity split already in place; extend Public with "Pitch My Talent".
- Every performer gets a public Booking Button™ page (`/book/<handle>`) — already partially built, harden it.
- Every recommendation must explain WHY (match reasons already exist in intelligence engine — extend everywhere).

## Slice A — Universal onboarding & multi-role identity
- New `/welcome` flow: "What brings you to Penya Play?" multi-select → creates the right sub-profiles.
- Extend `artist_owner_profiles`, add `venue_profiles`, `supplier_profiles`, `brand_profiles` (promoter_profiles + manager_profiles already exist).
- Handle (slug) + Booking Button URL reserved at signup.

## Slice B — Talent profile depth + Featured Performance
- Extend performer profile: technical rider, hospitality rider, base fee, floor fee, ceiling fee, territories, travel prefs.
- Required "Featured Performance" embed (YouTube / TikTok / IG / FB / Vimeo / upload) — first thing every buyer sees on the Booking Button page.

## Slice C — Venue Marketplace
- `venues` table (capacity, rental, calendar, sound, lighting, LED, parking, accommodation, indoor/outdoor, genres, photos, reviews, trust score).
- Routes: `/venues` (browse), `/venues/$slug` (public), `/_signedin/my-venues` (manage), `/_signedin/venues/new`.
- Venue calendar with open dates → feeds Fill-The-Route + Venue Intelligence.

## Slice D — Event Services Marketplace
- `suppliers` table (sound, lighting, stage, decor, catering, security, transport, accommodation, ticketing, photo, video).
- Auto-recommend suppliers when a promoter creates an event.

## Slice E — Booking Button™ page polish
- `/book/<handle>` public route: hero, verified badge, trust score, bio, featured performance, packages, live calendar, tour status, reviews, awards, past clients, AI booking summary.
- Smart booking form (event type, date, venue, city, country, budget, audience, duration, travel, accom, notes) → routes into existing booking pipeline.

## Slice F — AI Tour Planner + Fill-The-Route
- `/artist/tour-planner`: input territory/cities/dates/fee floor → engine builds optimized route using `artist_market_signals`, `artist_promoter_relations`, `venues`.
- Auto-detect "ON TOUR" when ≥2 confirmed bookings form a corridor; expose remaining open dates; nudge opted-in nearby venues.
- Gap detection: if Fri Joburg + Sun Pretoria, recommend Sat opportunities with revenue / travel / probability estimates.

## Slice G — Wallet & Escrow
- `wallets`, `wallet_transactions`, `escrow_holds` tables.
- Flow: Booking → Quote → Contract → Deposit → Escrow → Performance → Completion → Final Payment → Wallet → Withdrawal.
- Dispute record type. Withdraw request queue (manual settle for now; payment rail integration deferred).

## Slice H — Trust Engine (unified score)
- Roll professionalism, on-time, cancellation rate, reviews, repeats, response time, contract completion, verification into a single `trust_score` view per user; surface on every card.

## Slice I — AI Business Advisor + Match Engine explainability
- Per-role Advisor dashboard cards: artists (pricing / territories / tours / opps), venues (recommended artists, empty dates), promoters (lineup + budget + venue), suppliers (nearby events).
- Every match card shows a `compatibility %` with reason chips (audience overlap, pricing match, venue history, tour proximity, availability, genre fit).

## Slice J — Market Intelligence rollups
- Nightly job (pg_cron) aggregates avg booking fees, venue rentals, seasonal + regional demand, corporate/festival pricing, audience movement, touring patterns into `market_signals_global` (read-only, powers Advisor).

## Slice K — Opportunity Discovery expansion
- Extend existing `opportunity_sources` ingestion to cover ticketing platforms, venue calendars, festival sites, corporate/tourism/university/municipality calendars, hotels, casinos, promoter sites. Each ingested item labelled `public`, never with fabricated budget; Pitch-My-Talent CTA.

## Slice L — Design pass
- Afro-futurist black + graphite + warm metallic gold across every new surface. Performer/venue/promoter is always the hero; Penya Play is the frame.

## Technical details
- Migrations are additive; no destructive changes to existing tables.
- New tables follow the mandatory 4-step pattern (CREATE → GRANT → RLS → POLICY) with owner-scoped policies and `service_role` grants.
- Sensitive columns (fees, private notes) stay owner-only via RLS; public views project safe columns.
- Server logic uses `createServerFn` + `requireSupabaseAuth`; public read-only lists use the publishable-key server client with narrow `TO anon` policies.
- Booking Button pages are public routes with loader-fed `head()` (title/description/og:image from featured performance thumbnail).
- Discovery ingestion runs via `/api/public/cron/*` server routes gated by the existing `CRON_SECRET`/`apikey` pattern.
- Reuse `motion/react` primitives, existing `CinematicBackdrop`, `Card`, and shadcn components; no new UI framework.

## Sequencing
Ship A → B → E first (immediate visible value: universal signup, deeper profile, live Booking Buttons). Then C + D (marketplaces). Then F + H (touring + trust). Then G (wallet/escrow). Then I + J + K (advisor + market intel + discovery expansion). Design pass (L) applied continuously.

## Open questions
1. Start with Slice A (universal onboarding) or Slice E (Booking Button polish) first? Both are foundational; A unlocks new user types, E converts existing performers immediately.
2. Wallet & Escrow (Slice G) — settle withdrawals manually via admin in v1, or wire a payment rail (Paddle / Stripe managed payments) now?
3. Venue Marketplace (Slice C) — launch with self-serve venue signup, or admin-curated venues only for v1 to protect quality?
4. Trust Score (Slice H) — public numeric score, or private-to-owner + public tier badge (Bronze/Silver/Gold) only?
