-- ============================================================
-- MARKETPLACE FOUNDATION MIGRATION
-- ============================================================

-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'promoter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'artist';

-- ============================================================
-- PROMOTER PROFILES
-- ============================================================
CREATE TABLE public.promoter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  city TEXT,
  bio TEXT,
  website TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trust_score INT NOT NULL DEFAULT 0,
  confirmed_bookings INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.promoter_profiles TO authenticated;
GRANT SELECT ON public.promoter_profiles TO anon;
GRANT ALL ON public.promoter_profiles TO service_role;
ALTER TABLE public.promoter_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promoter_profiles public read verified"
  ON public.promoter_profiles FOR SELECT
  USING (true);

CREATE POLICY "promoter_profiles owner insert"
  ON public.promoter_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "promoter_profiles owner update"
  ON public.promoter_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "promoter_profiles admin all"
  ON public.promoter_profiles FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE TRIGGER trg_promoter_profiles_updated_at
  BEFORE UPDATE ON public.promoter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- MANAGER PROFILES
-- ============================================================
CREATE TABLE public.manager_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_name TEXT,
  contact_name TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  city TEXT,
  bio TEXT,
  website TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.manager_profiles TO authenticated;
GRANT SELECT ON public.manager_profiles TO anon;
GRANT ALL ON public.manager_profiles TO service_role;
ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_profiles public read"
  ON public.manager_profiles FOR SELECT
  USING (true);

CREATE POLICY "manager_profiles owner insert"
  ON public.manager_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manager_profiles owner update"
  ON public.manager_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "manager_profiles admin all"
  ON public.manager_profiles FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE TRIGGER trg_manager_profiles_updated_at
  BEFORE UPDATE ON public.manager_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ARTIST ROSTERS (a manager's list of representable artists)
-- ============================================================
CREATE TABLE public.artist_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.manager_profiles(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  genre TEXT,
  artist_type TEXT,
  base_city TEXT,
  base_country TEXT,
  bio TEXT,
  rate_hint_cents BIGINT,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_rosters TO authenticated;
GRANT ALL ON public.artist_rosters TO service_role;
ALTER TABLE public.artist_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artist_rosters manager owns"
  ON public.artist_rosters FOR ALL TO authenticated
  USING (
    manager_id IN (SELECT id FROM public.manager_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    manager_id IN (SELECT id FROM public.manager_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "artist_rosters admin all"
  ON public.artist_rosters FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE TRIGGER trg_artist_rosters_updated_at
  BEFORE UPDATE ON public.artist_rosters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_artist_rosters_manager ON public.artist_rosters(manager_id);

-- ============================================================
-- GIGS
-- ============================================================
CREATE TABLE public.gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id UUID NOT NULL REFERENCES public.promoter_profiles(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_type TEXT,
  event_date DATE NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  crowd_size INT NOT NULL DEFAULT 0,
  budget_low_cents BIGINT NOT NULL,
  budget_high_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  genre_needed TEXT[] NOT NULL DEFAULT '{}',
  artist_type_needed TEXT[] NOT NULL DEFAULT '{}',
  application_deadline DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  admin_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booked_application_id UUID,
  boost_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gigs_status_chk CHECK (status IN ('draft','pending_review','open','reviewing','shortlisted','booked','expired','rejected')),
  CONSTRAINT gigs_budget_chk CHECK (budget_high_cents >= budget_low_cents AND budget_low_cents >= 0)
);

GRANT SELECT, INSERT, UPDATE ON public.gigs TO authenticated;
GRANT SELECT ON public.gigs TO anon;
GRANT ALL ON public.gigs TO service_role;
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

-- Public can see approved+open gigs (deadline check enforced by app, not CHECK, to keep policy simple)
CREATE POLICY "gigs public read open"
  ON public.gigs FOR SELECT
  USING (status IN ('open','reviewing','shortlisted'));

CREATE POLICY "gigs promoter owns"
  ON public.gigs FOR ALL TO authenticated
  USING (
    promoter_id IN (SELECT id FROM public.promoter_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    promoter_id IN (SELECT id FROM public.promoter_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "gigs admin all"
  ON public.gigs FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE TRIGGER trg_gigs_updated_at
  BEFORE UPDATE ON public.gigs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_gigs_status ON public.gigs(status);
CREATE INDEX idx_gigs_promoter ON public.gigs(promoter_id);
CREATE INDEX idx_gigs_event_date ON public.gigs(event_date);
CREATE INDEX idx_gigs_deadline ON public.gigs(application_deadline);

-- ============================================================
-- GIG APPLICATIONS
-- ============================================================
CREATE TABLE public.gig_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.manager_profiles(id) ON DELETE CASCADE,
  roster_artist_id UUID REFERENCES public.artist_rosters(id) ON DELETE SET NULL,
  quote_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  availability_notes TEXT,
  rider_notes TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  shortlisted_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gig_applications_status_chk CHECK (status IN ('submitted','shortlisted','rejected','withdrawn','booked')),
  CONSTRAINT gig_applications_unique UNIQUE (gig_id, manager_id, roster_artist_id)
);

GRANT SELECT, INSERT, UPDATE ON public.gig_applications TO authenticated;
GRANT ALL ON public.gig_applications TO service_role;
ALTER TABLE public.gig_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gig_applications manager owns"
  ON public.gig_applications FOR ALL TO authenticated
  USING (
    manager_id IN (SELECT id FROM public.manager_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    manager_id IN (SELECT id FROM public.manager_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "gig_applications promoter reads own gig apps"
  ON public.gig_applications FOR SELECT TO authenticated
  USING (
    gig_id IN (
      SELECT g.id FROM public.gigs g
      JOIN public.promoter_profiles p ON p.id = g.promoter_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "gig_applications promoter updates status"
  ON public.gig_applications FOR UPDATE TO authenticated
  USING (
    gig_id IN (
      SELECT g.id FROM public.gigs g
      JOIN public.promoter_profiles p ON p.id = g.promoter_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    gig_id IN (
      SELECT g.id FROM public.gigs g
      JOIN public.promoter_profiles p ON p.id = g.promoter_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "gig_applications admin all"
  ON public.gig_applications FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE TRIGGER trg_gig_applications_updated_at
  BEFORE UPDATE ON public.gig_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_gig_applications_gig ON public.gig_applications(gig_id);
CREATE INDEX idx_gig_applications_manager ON public.gig_applications(manager_id);

-- ============================================================
-- SAVED GIGS
-- ============================================================
CREATE TABLE public.saved_gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES public.manager_profiles(id) ON DELETE CASCADE,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_id, gig_id)
);

GRANT SELECT, INSERT, DELETE ON public.saved_gigs TO authenticated;
GRANT ALL ON public.saved_gigs TO service_role;
ALTER TABLE public.saved_gigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_gigs manager owns"
  ON public.saved_gigs FOR ALL TO authenticated
  USING (
    manager_id IN (SELECT id FROM public.manager_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    manager_id IN (SELECT id FROM public.manager_profiles WHERE user_id = auth.uid())
  );

-- ============================================================
-- GIG MESSAGES (schema only for v1)
-- ============================================================
CREATE TABLE public.gig_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.gig_applications(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.gig_messages TO authenticated;
GRANT ALL ON public.gig_messages TO service_role;
ALTER TABLE public.gig_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gig_messages participants"
  ON public.gig_messages FOR SELECT TO authenticated
  USING (
    sender_user_id = auth.uid()
    OR gig_id IN (
      SELECT g.id FROM public.gigs g
      JOIN public.promoter_profiles p ON p.id = g.promoter_id
      WHERE p.user_id = auth.uid()
    )
    OR application_id IN (
      SELECT a.id FROM public.gig_applications a
      JOIN public.manager_profiles m ON m.id = a.manager_id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "gig_messages sender insert"
  ON public.gig_messages FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid());

CREATE POLICY "gig_messages admin all"
  ON public.gig_messages FOR ALL TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- ============================================================
-- GIG STATUS HISTORY
-- ============================================================
CREATE TABLE public.gig_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.gig_status_history TO authenticated;
GRANT ALL ON public.gig_status_history TO service_role;
ALTER TABLE public.gig_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gig_status_history readable to gig participants"
  ON public.gig_status_history FOR SELECT TO authenticated
  USING (
    gig_id IN (
      SELECT g.id FROM public.gigs g
      JOIN public.promoter_profiles p ON p.id = g.promoter_id
      WHERE p.user_id = auth.uid()
    )
    OR public.is_staff_or_admin()
  );

CREATE POLICY "gig_status_history admin insert"
  ON public.gig_status_history FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_gig_status_history_gig ON public.gig_status_history(gig_id);

-- Trigger to record status changes automatically
CREATE OR REPLACE FUNCTION public.log_gig_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.gig_status_history (gig_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.gig_status_history (gig_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gigs_status_history
  AFTER INSERT OR UPDATE OF status ON public.gigs
  FOR EACH ROW EXECUTE FUNCTION public.log_gig_status_change();

-- ============================================================
-- LINK BOOKINGS -> GIGS (for "convert to booking" flow)
-- ============================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source_gig_id UUID REFERENCES public.gigs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_application_id UUID REFERENCES public.gig_applications(id) ON DELETE SET NULL;
