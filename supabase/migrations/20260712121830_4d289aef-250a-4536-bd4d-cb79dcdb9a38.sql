
CREATE TABLE public.places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  region TEXT,
  country_code TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  timezone TEXT NOT NULL,
  local_currency TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, country_code)
);
GRANT SELECT ON public.places TO anon, authenticated;
GRANT ALL ON public.places TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.places TO authenticated;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places readable to all" ON public.places FOR SELECT USING (true);
CREATE POLICY "places writable by staff/admin" ON public.places FOR ALL
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

CREATE TABLE public.airports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iata_code TEXT NOT NULL UNIQUE,
  airport_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country_code TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  has_scheduled_commercial_service BOOLEAN NOT NULL DEFAULT true,
  service_last_verified_at DATE,
  source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (verification_status IN ('verified','needs_review','inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.airports TO anon, authenticated;
GRANT ALL ON public.airports TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.airports TO authenticated;
ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airports readable to all" ON public.airports FOR SELECT USING (true);
CREATE POLICY "airports writable by staff/admin" ON public.airports FOR ALL
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

CREATE TABLE public.airport_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  departure_iata TEXT NOT NULL REFERENCES public.airports(iata_code) ON DELETE CASCADE,
  arrival_iata TEXT NOT NULL REFERENCES public.airports(iata_code) ON DELETE CASCADE,
  airline TEXT,
  direct_service BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  last_verified_at DATE,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (departure_iata, arrival_iata, airline)
);
GRANT SELECT ON public.airport_routes TO anon, authenticated;
GRANT ALL ON public.airport_routes TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.airport_routes TO authenticated;
ALTER TABLE public.airport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airport_routes readable to all" ON public.airport_routes FOR SELECT USING (true);
CREATE POLICY "airport_routes writable by staff/admin" ON public.airport_routes FOR ALL
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

CREATE TABLE public.fx_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  source_name TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','needs_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fx_rates_pair_effective_idx
  ON public.fx_rates (base_currency, quote_currency, effective_at DESC);
GRANT SELECT ON public.fx_rates TO anon, authenticated;
GRANT ALL ON public.fx_rates TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.fx_rates TO authenticated;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_rates readable to all" ON public.fx_rates FOR SELECT USING (true);
CREATE POLICY "fx_rates writable by staff/admin" ON public.fx_rates FOR ALL
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

CREATE TABLE public.booking_logistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  performer_base_country TEXT,
  event_country TEXT,
  outbound_distance_km INTEGER,
  return_distance_km INTEGER,
  outbound_drive_minutes INTEGER,
  return_drive_minutes INTEGER,
  border_crossing_required BOOLEAN,
  estimated_border_delay_minutes INTEGER,
  performance_end_at TIMESTAMPTZ,
  estimated_home_arrival_at TIMESTAMPTZ,
  accommodation_recommended BOOLEAN,
  accommodation_reason TEXT,
  accommodation_selected TEXT
    CHECK (accommodation_selected IN ('required','preferred','not_required') OR accommodation_selected IS NULL),
  accommodation_override_reason TEXT,
  flight_comparison_recommended BOOLEAN,
  departure_airport_iata TEXT,
  arrival_airport_iata TEXT,
  event_currency TEXT,
  performer_home_currency TEXT,
  original_amount_minor BIGINT,
  original_currency_code TEXT,
  indicative_converted_amount_minor BIGINT,
  indicative_fx_rate NUMERIC(18,8),
  fx_rate_effective_at TIMESTAMPTZ,
  fx_conversion_method TEXT,
  travel_model_version TEXT,
  travel_confidence TEXT CHECK (travel_confidence IN ('high','medium','low') OR travel_confidence IS NULL),
  actual_travel_method TEXT,
  actual_travel_cost_minor BIGINT,
  actual_travel_currency TEXT,
  actual_arrival_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_logistics TO authenticated;
GRANT ALL ON public.booking_logistics TO service_role;
ALTER TABLE public.booking_logistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_logistics readable by staff/admin"
  ON public.booking_logistics FOR SELECT
  USING (public.is_staff_or_admin());
CREATE POLICY "booking_logistics writable by staff/admin"
  ON public.booking_logistics FOR ALL
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

CREATE TRIGGER set_places_updated_at BEFORE UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_airports_updated_at BEFORE UPDATE ON public.airports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_airport_routes_updated_at BEFORE UPDATE ON public.airport_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_fx_rates_updated_at BEFORE UPDATE ON public.fx_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_booking_logistics_updated_at BEFORE UPDATE ON public.booking_logistics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS base_city TEXT,
  ADD COLUMN IF NOT EXISTS base_country_code TEXT,
  ADD COLUMN IF NOT EXISTS base_latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS base_longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS base_timezone TEXT,
  ADD COLUMN IF NOT EXISTS max_preferred_drive_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS cross_border_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS passport_available BOOLEAN;

INSERT INTO public.places (city, region, country_code, latitude, longitude, timezone, local_currency) VALUES
  ('Maseru',        'Maseru',        'LS', -29.310000, 27.480000, 'Africa/Maseru',       'LSL'),
  ('Teyateyaneng',  'Berea',         'LS', -29.150000, 27.740000, 'Africa/Maseru',       'LSL'),
  ('Leribe',        'Leribe',        'LS', -28.870000, 28.050000, 'Africa/Maseru',       'LSL'),
  ('Mafeteng',      'Mafeteng',      'LS', -29.820000, 27.240000, 'Africa/Maseru',       'LSL'),
  ('Mohales Hoek',  'Mohales Hoek',  'LS', -30.150000, 27.470000, 'Africa/Maseru',       'LSL'),
  ('Qacha''s Nek',  'Qacha''s Nek',  'LS', -30.110000, 28.680000, 'Africa/Maseru',       'LSL'),
  ('Johannesburg',  'Gauteng',       'ZA', -26.204100, 28.047500, 'Africa/Johannesburg', 'ZAR'),
  ('Pretoria',      'Gauteng',       'ZA', -25.746100, 28.188100, 'Africa/Johannesburg', 'ZAR'),
  ('Cape Town',     'Western Cape',  'ZA', -33.924900, 18.424100, 'Africa/Johannesburg', 'ZAR'),
  ('Durban',        'KwaZulu-Natal', 'ZA', -29.858700, 31.021800, 'Africa/Johannesburg', 'ZAR'),
  ('Bloemfontein',  'Free State',    'ZA', -29.085400, 26.159600, 'Africa/Johannesburg', 'ZAR'),
  ('Port Elizabeth','Eastern Cape',  'ZA', -33.958100, 25.599800, 'Africa/Johannesburg', 'ZAR'),
  ('Gaborone',      'South East',    'BW', -24.628300, 25.923100, 'Africa/Gaborone',     'BWP'),
  ('Windhoek',      'Khomas',        'NA', -22.559400, 17.083200, 'Africa/Windhoek',     'NAD'),
  ('Maputo',        'Maputo',        'MZ', -25.966900, 32.583200, 'Africa/Maputo',       'MZN'),
  ('Mbabane',       'Hhohho',        'SZ', -26.317100, 31.139100, 'Africa/Mbabane',      'SZL'),
  ('Lusaka',        'Lusaka',        'ZM', -15.387500, 28.322800, 'Africa/Lusaka',       'ZMW'),
  ('Harare',        'Harare',        'ZW', -17.825200, 31.033500, 'Africa/Harare',       'ZWL')
ON CONFLICT (city, country_code) DO NOTHING;

INSERT INTO public.airports (iata_code, airport_name, city, country_code, latitude, longitude, verification_status, notes) VALUES
  ('MSU', 'Moshoeshoe I International Airport', 'Maseru',       'LS', -29.462300, 27.552500, 'needs_review', 'Airlink historically serves MSU-JNB; reverify schedule before recommending.'),
  ('BFN', 'Bram Fischer International Airport', 'Bloemfontein', 'ZA', -29.092700, 26.302400, 'needs_review', 'Airlink and FlySafair serve BFN-JNB/CPT; reverify.'),
  ('JNB', 'O. R. Tambo International Airport',  'Johannesburg', 'ZA', -26.139200, 28.246000, 'needs_review', NULL),
  ('CPT', 'Cape Town International Airport',    'Cape Town',    'ZA', -33.964800, 18.601700, 'needs_review', NULL),
  ('DUR', 'King Shaka International Airport',   'Durban',       'ZA', -29.614400, 31.119700, 'needs_review', NULL),
  ('PLZ', 'Chief Dawid Stuurman International', 'Port Elizabeth','ZA', -33.984900, 25.617300, 'needs_review', NULL),
  ('GBE', 'Sir Seretse Khama International',    'Gaborone',     'BW', -24.555200, 25.918200, 'needs_review', NULL),
  ('WDH', 'Hosea Kutako International Airport', 'Windhoek',     'NA', -22.480000, 17.470000, 'needs_review', NULL),
  ('MPM', 'Maputo International Airport',       'Maputo',       'MZ', -25.920800, 32.572600, 'needs_review', NULL)
ON CONFLICT (iata_code) DO NOTHING;

INSERT INTO public.fx_rates (base_currency, quote_currency, rate, source_name, status) VALUES
  ('ZAR', 'LSL', 1.00000000, 'CMA fixed peg', 'active'),
  ('LSL', 'ZAR', 1.00000000, 'CMA fixed peg', 'active'),
  ('ZAR', 'NAD', 1.00000000, 'CMA fixed peg', 'active'),
  ('ZAR', 'SZL', 1.00000000, 'CMA fixed peg', 'active'),
  ('ZAR', 'BWP', 0.75000000, 'manual indicative', 'active'),
  ('ZAR', 'MZN', 3.40000000, 'manual indicative', 'active'),
  ('ZAR', 'ZMW', 1.30000000, 'manual indicative', 'active'),
  ('ZAR', 'USD', 0.05500000, 'manual indicative', 'active'),
  ('ZAR', 'EUR', 0.05000000, 'manual indicative', 'active'),
  ('ZAR', 'GBP', 0.04300000, 'manual indicative', 'active');
