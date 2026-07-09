
-- Event type enum
DO $$ BEGIN
  CREATE TYPE public.performance_event_type AS ENUM (
    'festival','club','corporate','wedding','government','private','university','tv','radio','brand','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.artist_learning_event_kind AS ENUM (
    'pitch_sent','pitch_opened','pitch_replied','offer_received','accepted','declined','cancelled','booked','completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================
-- artist_venues (shared dedupe cache)
-- =========================
CREATE TABLE IF NOT EXISTS public.artist_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  province TEXT,
  country TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, city, country)
);

GRANT SELECT, INSERT, UPDATE ON public.artist_venues TO authenticated;
GRANT ALL ON public.artist_venues TO service_role;
ALTER TABLE public.artist_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read venues" ON public.artist_venues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert venues" ON public.artist_venues
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update venue" ON public.artist_venues
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER artist_venues_set_updated_at
  BEFORE UPDATE ON public.artist_venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- artist_performances
-- =========================
CREATE TABLE IF NOT EXISTS public.artist_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  venue_id UUID REFERENCES public.artist_venues(id) ON DELETE SET NULL,
  venue_name TEXT,
  venue_address TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  crowd_est INTEGER,
  headliner_bool BOOLEAN NOT NULL DEFAULT false,
  support_for TEXT,
  event_type public.performance_event_type NOT NULL DEFAULT 'other',
  fee_private BIGINT,
  fee_currency TEXT DEFAULT 'ZAR',
  promoter_name TEXT,
  promoter_id UUID REFERENCES public.promoters(id) ON DELETE SET NULL,
  rating SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  notes_private TEXT,
  proof_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artist_performances_owner_idx ON public.artist_performances(owner_id, event_date DESC);
CREATE INDEX IF NOT EXISTS artist_performances_city_idx ON public.artist_performances(owner_id, city);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_performances TO authenticated;
GRANT ALL ON public.artist_performances TO service_role;
ALTER TABLE public.artist_performances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own performances" ON public.artist_performances
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER artist_performances_set_updated_at
  BEFORE UPDATE ON public.artist_performances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- artist_promoter_relations (rollup)
-- =========================
CREATE TABLE IF NOT EXISTS public.artist_promoter_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promoter_name TEXT NOT NULL,
  promoter_id UUID REFERENCES public.promoters(id) ON DELETE SET NULL,
  booking_count INTEGER NOT NULL DEFAULT 0,
  last_booked_at DATE,
  avg_fee_private BIGINT,
  strength_score SMALLINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, promoter_name)
);

GRANT SELECT ON public.artist_promoter_relations TO authenticated;
GRANT ALL ON public.artist_promoter_relations TO service_role;
ALTER TABLE public.artist_promoter_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own promoter rollups" ON public.artist_promoter_relations
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

-- =========================
-- artist_market_signals (rollup per city)
-- =========================
CREATE TABLE IF NOT EXISTS public.artist_market_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  country TEXT,
  show_count INTEGER NOT NULL DEFAULT 0,
  repeat_bookings INTEGER NOT NULL DEFAULT 0,
  avg_crowd INTEGER,
  last_show_at DATE,
  season_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, city, country)
);

GRANT SELECT ON public.artist_market_signals TO authenticated;
GRANT ALL ON public.artist_market_signals TO service_role;
ALTER TABLE public.artist_market_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own market signals" ON public.artist_market_signals
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

-- =========================
-- artist_learning_events (append-only)
-- =========================
CREATE TABLE IF NOT EXISTS public.artist_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.artist_learning_event_kind NOT NULL,
  opportunity_id UUID,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artist_learning_events_owner_idx ON public.artist_learning_events(owner_id, created_at DESC);

GRANT SELECT, INSERT ON public.artist_learning_events TO authenticated;
GRANT ALL ON public.artist_learning_events TO service_role;
ALTER TABLE public.artist_learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own learning events" ON public.artist_learning_events
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner inserts own learning events" ON public.artist_learning_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

-- =========================
-- Rollup function + trigger
-- =========================
CREATE OR REPLACE FUNCTION public.refresh_artist_intel(_owner UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Market signals per city
  DELETE FROM public.artist_market_signals WHERE owner_id = _owner;
  INSERT INTO public.artist_market_signals (owner_id, city, country, show_count, repeat_bookings, avg_crowd, last_show_at, season_json)
  SELECT
    _owner,
    COALESCE(city, 'Unknown'),
    country,
    COUNT(*)::int,
    GREATEST(COUNT(*) - 1, 0)::int,
    NULLIF(AVG(crowd_est), 0)::int,
    MAX(event_date),
    COALESCE(jsonb_object_agg(mon, cnt), '{}'::jsonb)
  FROM (
    SELECT
      city, country, crowd_est, event_date,
      to_char(event_date, 'MM') AS mon,
      COUNT(*) OVER (PARTITION BY COALESCE(city,'Unknown'), country, to_char(event_date, 'MM')) AS cnt
    FROM public.artist_performances
    WHERE owner_id = _owner
  ) t
  GROUP BY city, country;

  -- Promoter relations
  DELETE FROM public.artist_promoter_relations WHERE owner_id = _owner;
  INSERT INTO public.artist_promoter_relations (owner_id, promoter_name, promoter_id, booking_count, last_booked_at, avg_fee_private, strength_score)
  SELECT
    _owner,
    promoter_name,
    MAX(promoter_id),
    COUNT(*)::int,
    MAX(event_date),
    NULLIF(AVG(fee_private), 0)::bigint,
    LEAST(100, COUNT(*)::int * 12)::smallint
  FROM public.artist_performances
  WHERE owner_id = _owner AND promoter_name IS NOT NULL AND promoter_name <> ''
  GROUP BY promoter_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_artist_intel(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.on_artist_performance_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_artist_intel(COALESCE(NEW.owner_id, OLD.owner_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS artist_performances_refresh_intel ON public.artist_performances;
CREATE TRIGGER artist_performances_refresh_intel
  AFTER INSERT OR UPDATE OR DELETE ON public.artist_performances
  FOR EACH ROW EXECUTE FUNCTION public.on_artist_performance_change();
