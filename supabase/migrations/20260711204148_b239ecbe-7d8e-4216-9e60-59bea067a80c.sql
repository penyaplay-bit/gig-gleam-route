
-- ============ user_trust ============
CREATE TABLE public.user_trust (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 3),
  phone_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  id_verified_at TIMESTAMPTZ,
  id_provider TEXT,
  business_verified_at TIMESTAMPTZ,
  risk_flags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_trust TO authenticated;
GRANT ALL ON public.user_trust TO service_role;
ALTER TABLE public.user_trust ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own trust" ON public.user_trust FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin());
CREATE POLICY "Users insert own trust" ON public.user_trust FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own trust" ON public.user_trust FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update any trust" ON public.user_trust FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_user_trust_updated_at BEFORE UPDATE ON public.user_trust
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ performer_trust ============
CREATE TABLE public.performer_trust (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_identity_verified_at TIMESTAMPTZ,
  bank_verified_at TIMESTAMPTZ,
  background_check_status TEXT NOT NULL DEFAULT 'none'
    CHECK (background_check_status IN ('none','requested','in_review','passed','failed','expired')),
  background_check_at TIMESTAMPTZ,
  family_event_verified_at TIMESTAMPTZ,
  references_count SMALLINT NOT NULL DEFAULT 0,
  professional_name_claimed_at TIMESTAMPTZ,
  featured_evidence_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.performer_trust TO authenticated;
GRANT ALL ON public.performer_trust TO service_role;
ALTER TABLE public.performer_trust ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Performers view own" ON public.performer_trust FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin());
CREATE POLICY "Performers insert own" ON public.performer_trust FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Performers update own limited" ON public.performer_trust FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update any performer_trust" ON public.performer_trust FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_performer_trust_updated_at BEFORE UPDATE ON public.performer_trust
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ trust_events (audit) ============
CREATE TABLE public.trust_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trust_events TO authenticated;
GRANT ALL ON public.trust_events TO service_role;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own trust events" ON public.trust_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff_or_admin());
CREATE INDEX idx_trust_events_user_created ON public.trust_events (user_id, created_at DESC);

-- ============ risk_signals ============
CREATE TABLE public.risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  kind TEXT NOT NULL,
  score SMALLINT NOT NULL DEFAULT 0,
  ip_hash TEXT,
  ua_hash TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.risk_signals TO authenticated;
GRANT ALL ON public.risk_signals TO service_role;
ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view risk signals" ON public.risk_signals FOR SELECT TO authenticated
  USING (public.is_staff_or_admin());
CREATE INDEX idx_risk_signals_created ON public.risk_signals (created_at DESC);
CREATE INDEX idx_risk_signals_user ON public.risk_signals (user_id);
