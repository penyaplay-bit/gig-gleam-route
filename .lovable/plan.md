
# Sprint 3 — Intelligent Pricing & Career Growth Engine

Additive extension of the existing artist profile + performances tables. No live AI claims, no fabricated forecasts, no public exposure of internal rates. Existing `base_fee` stays as-is and is mirrored into a new `standard_price` field so quotes keep working unchanged.

## 1. Data model (one migration)

Extend `public.artist_profiles` with a **Pricing Strategy** block (all cents, nullable except standard which defaults from `base_fee`):

- `standard_price` int — default rate (mirrors `base_fee` on first save)
- `dream_price` int — aspirational, never auto-quoted
- `minimum_price` int — hard floor; AI suggestions clamp here
- `growth_price` int, `growth_price_pct` smallint, `growth_price_enabled` bool — internal only
- `weekday_price` int, `weekday_price_days` smallint[] (0=Sun…6=Sat), `weekday_price_enabled` bool
- `last_minute_discount_pct` smallint, `last_minute_enabled` bool, `last_minute_window_days` smallint default 7
- `tour_price` int, `tour_radius_km` int, `tour_max_extra_km` int, `tour_price_enabled` bool
- `monthly_income_goal` bigint (cents), `monthly_goal_currency` text default 'ZAR'
- `opportunity_mode_enabled` bool default false

Extend `public.artist_performances` (already the calendar table) with:

- `booked_through` enum (`penya_play`, `whatsapp`, `phone`, `instagram`, `facebook`, `existing_client`, `manager`, `referral`, `other`)
- `status` enum (`confirmed`, `tentative`, `completed`, `cancelled`) default `confirmed`
- `province` already exists; add `venue_type` text nullable

New table `public.pricing_suggestions` (advisory log, never auto-applied):

- `owner_id`, `kind` (`enable_weekday`, `use_growth_price`, `enable_last_minute`, `update_standard`), `title`, `body`, `dismissed_at`, timestamps
- RLS: owner-only SELECT/UPDATE/DELETE; service_role INSERT for future job.

All new tables get GRANTs + RLS scoped to `auth.uid() = owner_id`. Migration is additive; no destructive changes to `base_fee` (kept as legacy alias, sync trigger writes `base_fee := standard_price` on update so `computeQuote` keeps working).

## 2. Copy (`src/lib/brand/copy.ts`)

Add keys for every user-facing string in this sprint (pricing questions, calendar prompts, dashboard empty states, suggestion cards, opportunity mode explainer). Enforce advisory language: `Recommended`, `Suggested`, `Based on your preferences`. Ban list stays enforced by review, not runtime.

## 3. UI — Pricing Profile

New tab **"Pricing strategy"** in `src/routes/_signedin/artist.profile.tsx`, wired to a new `updatePricingStrategy` server fn in `src/lib/artists/pricing.functions.ts`.

Sections (each collapsible card, each independently saveable):

1. Standard Booking Price (required, prefilled from `base_fee`)
2. Dream Price (optional) — badge "Never auto-quoted"
3. Minimum Acceptable Price (required) — badge "AI never suggests below this"
4. Growth Price — toggle + fixed/percent picker + "Internal only, never shown publicly"
5. Weekday Price — toggle + day multi-select + rate
6. Last-Minute Discount — toggle + preset chips (5/10/15/custom) + window days
7. Touring Price — toggle + rate + radius + max extra km
8. Monthly Income Goal — currency-aware input + rationale note

Validation: `minimum_price ≤ standard_price ≤ dream_price` (warn, don't block). All prices show currency code (no bare monetary numbers).

## 4. UI — Calendar & Off-platform Performances

Extend the existing performances UI (`src/lib/intel/performances.functions.ts` + its page) with:

- Add-performance form gains `booked_through` select (default `penya_play` for Penya bookings, else prompt), `status`, and honest copy: *"Add performances booked through WhatsApp, your manager, referrals or any other source. This information helps build your career history."*
- Bulk quick-add mode for past performances (date + venue + city + booked_through only).
- Penya-Play–originated bookings auto-write a performance row on `confirmed` with `booked_through = 'penya_play'`.

## 5. UI — Career Dashboard

New route `src/routes/_signedin/artist.career.tsx` (linked from artist dashboard). Cards render only real data pulled from `artist_performances` + `bookings`:

- Monthly Income Goal — progress bar of `sum(confirmed fees this month) / goal`. If no goal set → CTA to set one. If no confirmed fees → "No confirmed bookings yet this month."
- Confirmed Bookings (count, this month + next 90 days)
- Calendar Occupancy (weekends booked / weekends in period)
- Cities Performed (distinct count + list)
- Repeat Clients (promoters with ≥2 bookings)
- Average Booking Value (only counts rows with `fee_private`)
- Profile Views / Booking Enquiries — pull from existing counters if present, else hide the card (no zeros framed as insight)
- Empty state everywhere: *"More insights will appear as you complete more performances."*

No forecasts. No "predicted income." No fake trend lines.

## 6. Pricing Suggestions (advisory only)

Client-side derivation in `src/lib/pricing/suggestions.ts` — pure function over the loaded profile + performances. No cron, no AI call. Rules:

- If ≥3 unbooked weekdays in next 30 days AND `weekday_price_enabled = false` → suggest enable weekday.
- If new city detected on next confirmed booking AND `growth_price_enabled = false` → suggest growth price.
- If this Saturday unbooked AND `last_minute_enabled = false` → suggest last-minute.
- If avg confirmed fee last 90 days > standard_price × 1.1 → suggest reviewing standard rate.

Rendered as dismissible cards on career dashboard. "Apply" jumps to the pricing tab with that section highlighted — never mutates prices automatically.

## 7. Opportunity Mode

Toggle on career dashboard + pricing tab. Persists to `opportunity_mode_enabled`. Copy: *"When enabled, Penya Play prioritises showing you suitable opportunities during periods when your calendar is relatively open."* Filtering logic hooks into the existing gigs list ranking (light ordering nudge, not a new engine).

## 8. Reputation labeling

Wherever the artist card shows "Popularity" / follower counts as the headline metric, rename to **Professional Reputation** and compose from: completed performances, review count, response rate, repeat clients, calendar accuracy (% of past performances with completed status). Follower counts move to a secondary "Reach" strip.

## Files touched

- Migration: `supabase/migrations/…_pricing_strategy.sql`
- `src/lib/artists/pricing.functions.ts` (new)
- `src/lib/pricing/suggestions.ts` (new, pure)
- `src/routes/_signedin/artist.profile.tsx` (new tab)
- `src/routes/_signedin/artist.career.tsx` (new route)
- `src/lib/intel/performances.functions.ts` + its page (new fields)
- `src/lib/bookings.functions.ts` — on booking `confirmed`, mirror into `artist_performances` with `booked_through = 'penya_play'`
- `src/lib/brand/copy.ts` — new keys
- `src/components/artist/reputation-summary.tsx` — reputation composition

## Explicitly out of scope this sprint

- Live AI pricing agent (data collection only)
- Public exposure of dream/growth/minimum prices
- Automatic price changes
- Forecasts, predicted income, guaranteed earnings language
- OAuth follower ingestion (existing follow-up slice)

## Confirm before I build

1. Keep `base_fee` as the field the quote engine reads and auto-sync it from `standard_price` on save? (Alternative: swap the quote engine to read `standard_price` directly and drop `base_fee` in a follow-up.)
2. Career dashboard as a new sibling route `/artist/career`, or as a tab inside the existing `/artist` dashboard?
3. For pricing suggestions v1, pure client-side derivation is enough — agreed? (No cron, no AI call this sprint.)
