
-- 1. Add role value 'artist' to enum if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'artist' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'artist';
  END IF;
END $$;

-- 2. Extend promoter_profiles
ALTER TABLE public.promoter_profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS organization_type text,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- 3. Extend manager_profiles
ALTER TABLE public.manager_profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- 4. artist_owner_profiles
CREATE TABLE IF NOT EXISTS public.artist_owner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.manager_profiles(id) ON DELETE SET NULL,
  stage_name text NOT NULL,
  genres text[] NOT NULL DEFAULT '{}',
  location_city text,
  location_country text,
  booking_fee_min_cents bigint,
  booking_fee_max_cents bigint,
  currency text NOT NULL DEFAULT 'ZAR',
  whatsapp_number text,
  contact_email text,
  media_links text[] NOT NULL DEFAULT '{}',
  rider_notes text,
  bio text,
  photo_url text,
  availability_status text NOT NULL DEFAULT 'available',
  external_bookings_note text,
  last_schedule_update_at timestamptz,
  profile_completed boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_owner_profiles TO authenticated;
GRANT ALL ON public.artist_owner_profiles TO service_role;

ALTER TABLE public.artist_owner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artist_owner_profiles admin all" ON public.artist_owner_profiles
  TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE POLICY "artist_owner_profiles owner insert" ON public.artist_owner_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "artist_owner_profiles owner update" ON public.artist_owner_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "artist_owner_profiles owner delete" ON public.artist_owner_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "artist_owner_profiles signed-in read active" ON public.artist_owner_profiles
  FOR SELECT TO authenticated USING (active = true OR auth.uid() = user_id OR public.is_staff_or_admin());

CREATE TRIGGER artist_owner_profiles_updated_at
  BEFORE UPDATE ON public.artist_owner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_artist_owner_profiles_manager ON public.artist_owner_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_artist_owner_profiles_active ON public.artist_owner_profiles(active);

-- 5. artist_availability
CREATE TABLE IF NOT EXISTS public.artist_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_owner_id uuid NOT NULL REFERENCES public.artist_owner_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'unavailable', -- 'unavailable' | 'tentative' | 'available'
  note text,
  source text NOT NULL DEFAULT 'manual', -- 'manual' | 'external' | 'booking'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_owner_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_availability TO authenticated;
GRANT ALL ON public.artist_availability TO service_role;
ALTER TABLE public.artist_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artist_availability admin all" ON public.artist_availability
  TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE POLICY "artist_availability owner write" ON public.artist_availability
  FOR ALL TO authenticated
  USING (artist_owner_id IN (SELECT id FROM public.artist_owner_profiles WHERE user_id = auth.uid()))
  WITH CHECK (artist_owner_id IN (SELECT id FROM public.artist_owner_profiles WHERE user_id = auth.uid()));
CREATE POLICY "artist_availability signed-in read" ON public.artist_availability
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER artist_availability_updated_at
  BEFORE UPDATE ON public.artist_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_artist_availability_owner_date ON public.artist_availability(artist_owner_id, date);
