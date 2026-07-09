
-- Extend artist_owner_profiles
ALTER TABLE public.artist_owner_profiles
  ADD COLUMN IF NOT EXISTS demographics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS regional_strength TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS venue_fit_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============ artist_socials ============
CREATE TABLE public.artist_socials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_owner_id UUID NOT NULL REFERENCES public.artist_owner_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT,
  url TEXT,
  followers INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artist_owner_id, platform)
);
GRANT SELECT ON public.artist_socials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_socials TO authenticated;
GRANT ALL ON public.artist_socials TO service_role;
ALTER TABLE public.artist_socials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "socials public read" ON public.artist_socials FOR SELECT USING (true);
CREATE POLICY "socials owner write" ON public.artist_socials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artist_owner_profiles p WHERE p.id = artist_owner_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_owner_profiles p WHERE p.id = artist_owner_id AND p.user_id = auth.uid()));
CREATE TRIGGER trg_artist_socials_updated BEFORE UPDATE ON public.artist_socials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ artist_awards ============
CREATE TABLE public.artist_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_owner_id UUID NOT NULL REFERENCES public.artist_owner_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organisation TEXT,
  year INTEGER,
  tier TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artist_awards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_awards TO authenticated;
GRANT ALL ON public.artist_awards TO service_role;
ALTER TABLE public.artist_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "awards public read" ON public.artist_awards FOR SELECT USING (true);
CREATE POLICY "awards owner write" ON public.artist_awards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artist_owner_profiles p WHERE p.id = artist_owner_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_owner_profiles p WHERE p.id = artist_owner_id AND p.user_id = auth.uid()));

-- ============ artist_media ============
CREATE TABLE public.artist_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_owner_id UUID NOT NULL REFERENCES public.artist_owner_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artist_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_media TO authenticated;
GRANT ALL ON public.artist_media TO service_role;
ALTER TABLE public.artist_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media public read" ON public.artist_media FOR SELECT USING (true);
CREATE POLICY "media owner write" ON public.artist_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artist_owner_profiles p WHERE p.id = artist_owner_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artist_owner_profiles p WHERE p.id = artist_owner_id AND p.user_id = auth.uid()));

-- ============ artist_verifications ============
CREATE TABLE public.artist_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_owner_id UUID NOT NULL REFERENCES public.artist_owner_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artist_owner_id, kind)
);
GRANT SELECT ON public.artist_verifications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.artist_verifications TO authenticated;
GRANT ALL ON public.artist_verifications TO service_role;
ALTER TABLE public.artist_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verifications public read" ON public.artist_verifications FOR SELECT USING (true);
CREATE POLICY "verifications owner insert" ON public.artist_verifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.artist_owner_profiles p WHERE p.id = artist_owner_id AND p.user_id = auth.uid())
    AND status = 'pending'
  );
CREATE POLICY "verifications staff update" ON public.artist_verifications FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());
CREATE TRIGGER trg_artist_verifications_updated BEFORE UPDATE ON public.artist_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ artist_reviews ============
CREATE TABLE public.artist_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_owner_id UUID NOT NULL REFERENCES public.artist_owner_profiles(id) ON DELETE CASCADE,
  gig_id UUID REFERENCES public.gigs(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.gig_applications(id) ON DELETE SET NULL,
  promoter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  on_time BOOLEAN,
  professionalism INTEGER CHECK (professionalism BETWEEN 1 AND 5),
  would_rebook BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, promoter_id)
);
GRANT SELECT ON public.artist_reviews TO anon;
GRANT SELECT, INSERT ON public.artist_reviews TO authenticated;
GRANT ALL ON public.artist_reviews TO service_role;
ALTER TABLE public.artist_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.artist_reviews FOR SELECT USING (true);
CREATE POLICY "reviews booker insert" ON public.artist_reviews FOR INSERT TO authenticated
  WITH CHECK (
    promoter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.gig_applications ga
      JOIN public.gigs g ON g.id = ga.gig_id
      WHERE ga.id = artist_reviews.application_id
        AND g.promoter_id = auth.uid()
        AND ga.status = 'booked'
    )
  );

-- ============ artist_stats (cached scoring) ============
CREATE TABLE public.artist_stats (
  artist_owner_id UUID PRIMARY KEY REFERENCES public.artist_owner_profiles(id) ON DELETE CASCADE,
  intelligence_score INTEGER,
  tier TEXT,
  subscores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reach_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  history_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  momentum_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  insights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artist_stats TO anon, authenticated;
GRANT ALL ON public.artist_stats TO service_role;
ALTER TABLE public.artist_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats public read" ON public.artist_stats FOR SELECT USING (true);
CREATE TRIGGER trg_artist_stats_updated BEFORE UPDATE ON public.artist_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
