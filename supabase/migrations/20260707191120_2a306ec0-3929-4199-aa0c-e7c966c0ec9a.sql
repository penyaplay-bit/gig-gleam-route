
-- ============ artist_profiles ============
CREATE TABLE public.artist_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  base_fee integer NOT NULL DEFAULT 0,         -- cents (e.g. R50,000 = 5000000)
  default_team_size integer NOT NULL DEFAULT 1,
  home_city text,
  home_country text NOT NULL DEFAULT 'South Africa',
  -- Config JSON blobs (versioned by profile_version)
  transport_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  accommodation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  per_diem_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  cancellation_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  rider jsonb NOT NULL DEFAULT '{}'::jsonb,
  banking jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_margin_pct integer NOT NULL DEFAULT 20,  -- profitability floor for AI
  profile_version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_profiles TO authenticated;
GRANT ALL ON public.artist_profiles TO service_role;

ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view active artist profiles"
  ON public.artist_profiles FOR SELECT
  TO authenticated
  USING (active = true OR public.is_staff_or_admin());

CREATE POLICY "Admins manage artist profiles"
  ON public.artist_profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER artist_profiles_updated_at
  BEFORE UPDATE ON public.artist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ quotation_templates ============
CREATE TABLE public.quotation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_profile_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_templates TO authenticated;
GRANT ALL ON public.quotation_templates TO service_role;

ALTER TABLE public.quotation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view quotation templates"
  ON public.quotation_templates FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

CREATE POLICY "Admins manage quotation templates"
  ON public.quotation_templates FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER quotation_templates_updated_at
  BEFORE UPDATE ON public.quotation_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ event_quotes extensions ============
ALTER TABLE public.event_quotes
  ADD COLUMN IF NOT EXISTS artist_profile_id uuid REFERENCES public.artist_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_version integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ZAR',
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fee_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logistics_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_suggestion jsonb;

-- ============ Seed Ntate Stunna Standard Booking Template ============
INSERT INTO public.artist_profiles (
  name, currency, base_fee, default_team_size, home_city, home_country,
  transport_rules, accommodation_rules, per_diem_rules, payment_terms,
  cancellation_terms, rider, banking, min_margin_pct, notes
) VALUES (
  'Ntate Stunna',
  'ZAR',
  5000000,       -- R50,000 in cents
  5,
  'Maseru',
  'Lesotho',
  jsonb_build_object(
    'car_hire_day_rate', 300000,      -- R3,000
    'fuel_rate_per_km', 250,          -- R2.50/km
    'default_car_hire_days', 2,
    'default_fuel_estimate', 250000,  -- R2,500
    'local_max_km', 100,
    'car_hire_max_km', 400,
    'overnight_min_km', 400,
    'flight_seat_estimate', 250000    -- R2,500 per seat placeholder
  ),
  jsonb_build_object(
    'room_rate', 90000,               -- R900/room/night
    'pax_per_room', 2,
    'default_nights', 1,
    'default_total', 450000           -- R4,500
  ),
  jsonb_build_object(
    'per_person_per_day', 0
  ),
  jsonb_build_object(
    'booking_logistics_pct', 100,
    'booking_fee_pct', 50,
    'final_fee_pct', 50,
    'final_days_before_event', 7
  ),
  jsonb_build_object(
    'weather_force_majeure',
      'No refund on cancellation due to adverse weather or force majeure. Deposits are non-refundable and may be credited to a rescheduled date at the artist''s discretion.',
    'artist_fault',
      'If the artist cancels, deposits remain non-refundable. The promoter may reschedule within 90 days at no additional cost, subject to availability.',
    'promoter_fault',
      'If the promoter cancels or breaches, deposits are non-refundable and the promoter remains liable for the full quoted amount unless a written alternative is agreed.',
    'rider_compliance',
      'The hospitality rider must be fulfilled in full and made available in the artist''s dressing room prior to arrival. Non-compliance may result in delay or cancellation at the artist''s discretion, with no refund.'
  ),
  jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Food & Beverages',
        'items', jsonb_build_array(
          jsonb_build_object('label','Water','scale','fixed','qty',1,'note','Still & sparkling'),
          jsonb_build_object('label','Hennessy VSOP','scale','fixed','qty',1,'note','x1 (or Hennessy Original x2 + Ginger Ale)'),
          jsonb_build_object('label','Veuve Rich','scale','fixed','qty',2),
          jsonb_build_object('label','Food platters','scale','per_team','qty',1,'note','One per team member'),
          jsonb_build_object('label','Red Bull','scale','fixed','qty',6,'note','6-pack'),
          jsonb_build_object('label','Ice','scale','fixed','qty',1)
        )
      ),
      jsonb_build_object(
        'title', 'Accommodation',
        'items', jsonb_build_array(
          jsonb_build_object('label','Hotel rooms','scale','per_room','qty',1,'note','Auto-scales with team size')
        )
      )
    )
  ),
  jsonb_build_object(
    'account_name', 'PENYA PLAY PRODUCTIONS PTY LTD',
    'bank', 'FNB/RMB',
    'account_type', 'Business Cheque Account',
    'account_number', '63182765231'
  ),
  20,
  'Seeded from the Matjhabeng Fashion Week 2026 quotation (NS-MMCR-20261109).'
);

INSERT INTO public.quotation_templates (artist_profile_id, name, description, is_default, defaults)
SELECT id, 'Ntate Stunna Standard Booking Template',
       'Default booking template based on the R50,000 performance fee + R13,000 logistics standard.',
       true,
       jsonb_build_object(
         'default_car_hire_days', 2,
         'default_nights', 1,
         'team_size', 5
       )
FROM public.artist_profiles WHERE name = 'Ntate Stunna';
