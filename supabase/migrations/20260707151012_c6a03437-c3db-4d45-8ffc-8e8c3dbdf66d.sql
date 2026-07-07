
-- ============================================================================
-- Penya Play Booking OS — Foundation Schema
-- ============================================================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TYPE public.booking_status AS ENUM (
  'new', 'reviewing', 'quote_sent', 'offer_submitted',
  'counter_offer', 'deposit_pending', 'confirmed',
  'completed', 'cancelled', 'declined'
);

CREATE TYPE public.deposit_status AS ENUM ('uploaded', 'verified', 'rejected');

-- Reusable updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- user_roles + has_role helper
-- ============================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role);
$$;

-- Bootstrap: the first user to sign up becomes admin. Later admins are granted via SQL / UI.
CREATE OR REPLACE FUNCTION public.grant_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_first_admin();

-- ============================================================================
-- artists
-- ============================================================================
CREATE TABLE public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  home_city TEXT NOT NULL DEFAULT 'Maseru',
  base_fee INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.artists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artists TO authenticated;
GRANT ALL ON public.artists TO service_role;

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active artists"
  ON public.artists FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.is_staff_or_admin());

CREATE POLICY "Admins manage artists"
  ON public.artists FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER artists_updated_at BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- packages
-- ============================================================================
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL,
  crew_size INTEGER NOT NULL DEFAULT 1,
  duration_minutes INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON public.packages FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.is_staff_or_admin());

CREATE POLICY "Admins manage packages"
  ON public.packages FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER packages_updated_at BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- pricing_rules (per-artist config: fuel, per-diem, deposit %, etc.)
-- ============================================================================
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artist_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pricing rules"
  ON public.pricing_rules FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins manage pricing rules"
  ON public.pricing_rules FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- promoters (CRM)
-- ============================================================================
CREATE TABLE public.promoters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  whatsapp TEXT,
  country TEXT,
  city TEXT,
  social_links JSONB DEFAULT '[]'::jsonb,
  reliability_score INTEGER NOT NULL DEFAULT 50,
  total_revenue INTEGER NOT NULL DEFAULT 0,
  bookings_count INTEGER NOT NULL DEFAULT 0,
  blacklisted BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promoters TO authenticated;
GRANT ALL ON public.promoters TO service_role;
-- Anon can INSERT via public server route only (validated), we do this via service role.

ALTER TABLE public.promoters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view promoters"
  ON public.promoters FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins manage promoters"
  ON public.promoters FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER promoters_updated_at BEFORE UPDATE ON public.promoters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- bookings
-- ============================================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT NOT NULL UNIQUE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE RESTRICT,
  promoter_id UUID REFERENCES public.promoters(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  venue TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Lesotho',
  event_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  ends_after_10pm BOOLEAN NOT NULL DEFAULT false,

  crowd_size INTEGER,
  ticket_price INTEGER,
  has_sponsors BOOLEAN NOT NULL DEFAULT false,
  has_media BOOLEAN NOT NULL DEFAULT false,
  event_class TEXT NOT NULL DEFAULT 'private',

  client_offer INTEGER,
  budget_min INTEGER,
  deposit_ready BOOLEAN NOT NULL DEFAULT false,
  proof_link TEXT,

  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  preferred_contact TEXT NOT NULL DEFAULT 'whatsapp',
  description TEXT,

  status booking_status NOT NULL DEFAULT 'new',
  score INTEGER NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,

  quoted_amount INTEGER,
  quote_breakdown JSONB,
  deposit_pct INTEGER NOT NULL DEFAULT 50,
  deposit_amount INTEGER,
  balance_amount INTEGER,
  deposit_verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bookings_status_idx ON public.bookings(status);
CREATE INDEX bookings_event_date_idx ON public.bookings(event_date);
CREATE INDEX bookings_artist_id_idx ON public.bookings(artist_id);
CREATE INDEX bookings_promoter_id_idx ON public.bookings(promoter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins manage bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- booking_notes
-- ============================================================================
CREATE TABLE public.booking_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  internal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_notes_booking_id_idx ON public.booking_notes(booking_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_notes TO authenticated;
GRANT ALL ON public.booking_notes TO service_role;

ALTER TABLE public.booking_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view notes"
  ON public.booking_notes FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Staff insert notes"
  ON public.booking_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff_or_admin() AND author_id = auth.uid());

CREATE POLICY "Admins manage notes"
  ON public.booking_notes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- deposits
-- ============================================================================
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  pop_path TEXT,
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  uploaded_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status deposit_status NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX deposits_booking_id_idx ON public.deposits(booking_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view deposits"
  ON public.deposits FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins manage deposits"
  ON public.deposits FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
