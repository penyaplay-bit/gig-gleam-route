
CREATE TABLE public.event_health (
  event_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  health_score INT NOT NULL DEFAULT 0 CHECK (health_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL DEFAULT 'yellow' CHECK (risk_level IN ('green','yellow','red','black')),
  pulse TEXT NOT NULL DEFAULT 'yellow' CHECK (pulse IN ('green','yellow','red','black')),
  financial_lock TEXT NOT NULL DEFAULT 'none' CHECK (financial_lock IN ('none','pending','cleared','broken','default')),
  pillar_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_best_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  predicted_failure_pct INT NOT NULL DEFAULT 0 CHECK (predicted_failure_pct BETWEEN 0 AND 100),
  predicted_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stale BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_health TO authenticated;
GRANT ALL ON public.event_health TO service_role;

ALTER TABLE public.event_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view event health"
  ON public.event_health FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE INDEX event_health_risk_idx ON public.event_health (risk_level, health_score);
CREATE INDEX event_health_stale_idx ON public.event_health (stale) WHERE stale = true;

CREATE TABLE public.event_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  health_score INT NOT NULL,
  risk_level TEXT NOT NULL,
  pillar_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_health_history TO authenticated;
GRANT ALL ON public.event_health_history TO service_role;

ALTER TABLE public.event_health_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view health history"
  ON public.event_health_history FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());

CREATE INDEX event_health_history_event_idx
  ON public.event_health_history (event_id, snapshot_at DESC);

CREATE OR REPLACE FUNCTION public.mark_event_health_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    v_event_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  END IF;

  IF v_event_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.event_health (event_id, stale, updated_at)
  VALUES (v_event_id, true, now())
  ON CONFLICT (event_id) DO UPDATE
    SET stale = true, updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'bookings','event_payments','event_logistics','event_contracts',
    'event_campaign','event_documents','event_parties','event_tasks',
    'event_overrides','event_messages'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS mark_event_health_stale_trg ON public.%I; '
      'CREATE TRIGGER mark_event_health_stale_trg '
      'AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.mark_event_health_stale();',
      t, t
    );
  END LOOP;
END $$;

INSERT INTO public.event_health (event_id, stale)
SELECT id, true FROM public.bookings
ON CONFLICT (event_id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_health;
