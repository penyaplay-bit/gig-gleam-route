
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE public.profile_intent AS ENUM (
  'get_booked','hire_talent','list_venue','organize_events','provide_services','manage_talent','represent_brand'
);

CREATE TABLE public.profile_intents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intent public.profile_intent NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, intent)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_intents TO authenticated;
GRANT ALL ON public.profile_intents TO service_role;
ALTER TABLE public.profile_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own intents read" ON public.profile_intents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own intents write" ON public.profile_intents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TYPE public.handle_kind AS ENUM ('performer','venue','promoter','supplier','brand','manager');

CREATE TABLE public.handles (
  handle citext PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.handle_kind NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX handles_user_id_idx ON public.handles(user_id);
GRANT SELECT ON public.handles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.handles TO authenticated;
GRANT ALL ON public.handles TO service_role;
ALTER TABLE public.handles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handles are publicly readable" ON public.handles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner manages own handle" ON public.handles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER handles_set_updated_at BEFORE UPDATE ON public.handles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.artist_owner_profiles
  ADD COLUMN IF NOT EXISTS featured_performance_url text,
  ADD COLUMN IF NOT EXISTS featured_performance_thumb text,
  ADD COLUMN IF NOT EXISTS booking_fee_floor_cents bigint,
  ADD COLUMN IF NOT EXISTS booking_fee_ceiling_cents bigint,
  ADD COLUMN IF NOT EXISTS technical_rider text,
  ADD COLUMN IF NOT EXISTS hospitality_rider text;

-- Add safe public projection of performer profiles for the Booking Button.
-- A narrow anon SELECT policy on artist_owner_profiles would leak fees/rider,
-- so we expose a security_invoker view that only projects public columns.
CREATE OR REPLACE VIEW public.performer_public AS
  SELECT
    p.user_id,
    p.stage_name,
    p.bio,
    p.photo_url,
    p.genres,
    p.location_city,
    p.location_country,
    p.featured_performance_url,
    p.featured_performance_thumb,
    p.availability_status
  FROM public.artist_owner_profiles p
  WHERE p.active IS TRUE;

-- View reads inherit RLS from the base table by default; grant + policy for anon.
GRANT SELECT ON public.performer_public TO anon, authenticated;
DROP POLICY IF EXISTS "performer profile public columns" ON public.artist_owner_profiles;
CREATE POLICY "performer profile public columns" ON public.artist_owner_profiles
  FOR SELECT TO anon USING (active IS TRUE);
