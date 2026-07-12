
-- Enums
DO $$ BEGIN
  CREATE TYPE public.booked_through_source AS ENUM
    ('penya_play','whatsapp','phone','instagram','facebook','existing_client','manager','referral','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.performance_status AS ENUM ('confirmed','tentative','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pricing_suggestion_kind AS ENUM
    ('enable_weekday','use_growth_price','enable_last_minute','update_standard','enable_touring');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend artist_profiles with pricing strategy
ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS standard_price integer,
  ADD COLUMN IF NOT EXISTS dream_price integer,
  ADD COLUMN IF NOT EXISTS minimum_price integer,
  ADD COLUMN IF NOT EXISTS growth_price integer,
  ADD COLUMN IF NOT EXISTS growth_price_pct smallint,
  ADD COLUMN IF NOT EXISTS growth_price_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekday_price integer,
  ADD COLUMN IF NOT EXISTS weekday_price_days smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weekday_price_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_minute_discount_pct smallint,
  ADD COLUMN IF NOT EXISTS last_minute_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_minute_window_days smallint NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS tour_price integer,
  ADD COLUMN IF NOT EXISTS tour_radius_km integer,
  ADD COLUMN IF NOT EXISTS tour_max_extra_km integer,
  ADD COLUMN IF NOT EXISTS tour_price_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_income_goal bigint,
  ADD COLUMN IF NOT EXISTS monthly_goal_currency text NOT NULL DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS opportunity_mode_enabled boolean NOT NULL DEFAULT false;

-- Backfill standard_price from base_fee where null
UPDATE public.artist_profiles SET standard_price = base_fee WHERE standard_price IS NULL;

-- Trigger: keep base_fee in sync with standard_price so the quote engine keeps working
CREATE OR REPLACE FUNCTION public.sync_base_fee_from_standard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.standard_price IS NOT NULL AND NEW.standard_price IS DISTINCT FROM OLD.base_fee THEN
    NEW.base_fee := NEW.standard_price;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS artist_profiles_sync_base_fee ON public.artist_profiles;
CREATE TRIGGER artist_profiles_sync_base_fee
  BEFORE INSERT OR UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_base_fee_from_standard();

-- Extend artist_performances with calendar/source fields
ALTER TABLE public.artist_performances
  ADD COLUMN IF NOT EXISTS booked_through public.booked_through_source,
  ADD COLUMN IF NOT EXISTS status public.performance_status NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS venue_type text;

-- New table: pricing_suggestions (advisory only, never auto-applied)
CREATE TABLE IF NOT EXISTS public.pricing_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.pricing_suggestion_kind NOT NULL,
  title text NOT NULL,
  body text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pricing_suggestions_owner_idx
  ON public.pricing_suggestions (owner_id, dismissed_at NULLS FIRST, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_suggestions TO authenticated;
GRANT ALL ON public.pricing_suggestions TO service_role;

ALTER TABLE public.pricing_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their pricing suggestions" ON public.pricing_suggestions;
CREATE POLICY "Owners manage their pricing suggestions"
  ON public.pricing_suggestions
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP TRIGGER IF EXISTS pricing_suggestions_updated_at ON public.pricing_suggestions;
CREATE TRIGGER pricing_suggestions_updated_at
  BEFORE UPDATE ON public.pricing_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
