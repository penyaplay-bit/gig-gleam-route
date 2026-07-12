
ALTER TABLE public.artist_owner_profiles
  ADD COLUMN IF NOT EXISTS standard_price_cents integer,
  ADD COLUMN IF NOT EXISTS dream_price_cents integer,
  ADD COLUMN IF NOT EXISTS minimum_price_cents integer,
  ADD COLUMN IF NOT EXISTS growth_price_cents integer,
  ADD COLUMN IF NOT EXISTS growth_price_pct smallint,
  ADD COLUMN IF NOT EXISTS growth_price_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekday_price_cents integer,
  ADD COLUMN IF NOT EXISTS weekday_price_days smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weekday_price_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_minute_discount_pct smallint,
  ADD COLUMN IF NOT EXISTS last_minute_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_minute_window_days smallint NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS tour_price_cents integer,
  ADD COLUMN IF NOT EXISTS tour_radius_km integer,
  ADD COLUMN IF NOT EXISTS tour_max_extra_km integer,
  ADD COLUMN IF NOT EXISTS tour_price_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_income_goal_cents bigint,
  ADD COLUMN IF NOT EXISTS monthly_goal_currency text NOT NULL DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS opportunity_mode_enabled boolean NOT NULL DEFAULT false;

-- Backfill standard from legacy min fee if present
UPDATE public.artist_owner_profiles
   SET standard_price_cents = booking_fee_min_cents
 WHERE standard_price_cents IS NULL AND booking_fee_min_cents IS NOT NULL;
