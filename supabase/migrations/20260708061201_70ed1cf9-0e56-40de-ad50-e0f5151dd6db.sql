
DO $$
DECLARE
  p1 uuid := '11111111-1111-1111-1111-111111111111';
  p2 uuid := '11111111-1111-1111-1111-111111111112';
  m1 uuid := '22222222-2222-2222-2222-222222222221';
  m2 uuid := '22222222-2222-2222-2222-222222222222';
  pp1 uuid; pp2 uuid; mm1 uuid; mm2 uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid;
  g1 uuid; g2 uuid; g5 uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.gigs LIMIT 1) THEN RETURN; END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (p1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-promoter1@faredeal.dev', crypt('demoPassword!1', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"demo":true}'),
    (p2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-promoter2@faredeal.dev', crypt('demoPassword!1', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"demo":true}'),
    (m1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-manager1@faredeal.dev', crypt('demoPassword!1', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"demo":true}'),
    (m2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-manager2@faredeal.dev', crypt('demoPassword!1', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"demo":true}')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES
    (p1, 'promoter'), (p2, 'promoter'), (m1, 'manager'), (m2, 'manager')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.promoter_profiles (user_id, company_name, contact_name, phone, country, city, bio, verified, verified_at, trust_score, confirmed_bookings) VALUES
    (p1, 'Skyline Live', 'Nomsa Dlamini', '+27 82 555 1010', 'South Africa', 'Johannesburg', 'Independent event house running rooftop and warehouse shows since 2019.', true, now(), 85, 5),
    (p2, 'Coastline Collective', 'Thabo Mokoena', '+27 83 555 2020', 'South Africa', 'Cape Town', 'Boutique beach club promoter — summer season residencies.', true, now(), 70, 2)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.manager_profiles (user_id, agency_name, contact_name, phone, country, city, bio, verified, verified_at) VALUES
    (m1, 'Northside Talent', 'Kabelo Nkosi', '+27 82 555 3030', 'South Africa', 'Pretoria', 'Boutique roster of amapiano and afrohouse acts.', true, now()),
    (m2, 'Atlas Bookings', 'Zanele Mahlangu', '+27 84 555 4040', 'South Africa', 'Durban', 'Afro-tech, deep house, and live band representation across SADC.', true, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO pp1 FROM public.promoter_profiles WHERE user_id = p1;
  SELECT id INTO pp2 FROM public.promoter_profiles WHERE user_id = p2;
  SELECT id INTO mm1 FROM public.manager_profiles  WHERE user_id = m1;
  SELECT id INTO mm2 FROM public.manager_profiles  WHERE user_id = m2;

  INSERT INTO public.artist_rosters (manager_id, artist_name, genre, artist_type, base_city, base_country, bio, rate_hint_cents, currency) VALUES
    (mm1, 'DJ Lerato',          'amapiano',   'dj',       'Johannesburg', 'South Africa', 'Weekly resident at three JHB clubs.', 3500000, 'ZAR'),
    (mm1, 'Bandi B',             'amapiano',   'dj',       'Johannesburg', 'South Africa', 'Rising amapiano producer/dj.',        5500000, 'ZAR'),
    (mm1, 'Kholeka Live Band',   'afro-soul',  'band',     'Pretoria',     'South Africa', '7-piece live afro-soul ensemble.',    8000000, 'ZAR'),
    (mm2, 'Sipho N',             'afro-tech',  'dj',       'Cape Town',    'South Africa', 'Ibiza-tested afro-tech dj.',          4500000, 'ZAR'),
    (mm2, 'Neo M',               'afro-soul',  'vocalist', 'Durban',       'South Africa', 'Session vocalist and solo performer.',2500000, 'ZAR'),
    (mm2, 'Coastal Sound Collective','afro-fusion','band', 'Cape Town',    'South Africa', 'Coastal afro-fusion 5-piece.',        6500000, 'ZAR');

  SELECT id INTO a1 FROM public.artist_rosters WHERE manager_id = mm1 AND artist_name = 'DJ Lerato';
  SELECT id INTO a2 FROM public.artist_rosters WHERE manager_id = mm1 AND artist_name = 'Bandi B';
  SELECT id INTO a3 FROM public.artist_rosters WHERE manager_id = mm2 AND artist_name = 'Sipho N';
  SELECT id INTO a4 FROM public.artist_rosters WHERE manager_id = mm2 AND artist_name = 'Coastal Sound Collective';

  INSERT INTO public.gigs (promoter_id, event_name, event_type, event_date, venue, city, country, crowd_size, budget_low_cents, budget_high_cents, currency, genre_needed, artist_type_needed, application_deadline, description, status, approved_at, approved_by) VALUES
    (pp1, 'Skyline Rooftop Summer Opening', 'club',      (CURRENT_DATE + 45),  'The Marc Rooftop',          'Johannesburg', 'South Africa',  800,  4000000,  7500000, 'ZAR', ARRAY['amapiano','afrohouse'],           ARRAY['dj'],           (CURRENT_DATE + 20), 'Season opener with two support slots + one headliner.', 'open', now(), p1),
    (pp1, 'Newtown Warehouse Takeover',     'warehouse', (CURRENT_DATE + 60),  'Warehouse 88',              'Johannesburg', 'South Africa', 1500,  8000000, 15000000, 'ZAR', ARRAY['amapiano'],                        ARRAY['dj'],           (CURRENT_DATE + 25), 'Late-night takeover, 4-hour headline set.',              'open', now(), p1),
    (pp1, 'Corporate Year-End Awards',      'corporate', (CURRENT_DATE + 90),  'Sandton Convention Centre', 'Johannesburg', 'South Africa',  400,  6000000, 10000000, 'ZAR', ARRAY['afro-soul','jazz'],                ARRAY['band','vocalist'], (CURRENT_DATE + 40), 'Live band + vocalist for corporate awards dinner.',   'open', now(), p1),
    (pp2, 'Camps Bay Beach Sunset Series',  'beach',     (CURRENT_DATE + 30),  'Café Caprice',              'Cape Town',    'South Africa',  600,  3500000,  6000000, 'ZAR', ARRAY['deep-house','afro-tech'],          ARRAY['dj'],           (CURRENT_DATE + 12), 'Sunset residency, four Sundays.',                        'open', now(), p2),
    (pp2, 'Long Street NYE Block Party',    'festival',  (CURRENT_DATE + 120), 'Long Street',               'Cape Town',    'South Africa', 5000, 15000000, 30000000, 'ZAR', ARRAY['amapiano','afro-tech','deep-house'], ARRAY['dj','band'],  (CURRENT_DATE + 50), 'NYE main-stage headliner + two support.',                'open', now(), p2),
    (pp2, 'V&A Waterfront Live Sessions',   'live',      (CURRENT_DATE + 20),  'Amphitheatre',              'Cape Town',    'South Africa', 1200,  4500000,  7000000, 'ZAR', ARRAY['afro-fusion','afro-soul'],         ARRAY['band'],         (CURRENT_DATE + 8),  'Family friendly Sunday live series.',                    'open', now(), p2);

  SELECT id INTO g1 FROM public.gigs WHERE promoter_id = pp1 AND event_name = 'Skyline Rooftop Summer Opening';
  SELECT id INTO g2 FROM public.gigs WHERE promoter_id = pp1 AND event_name = 'Newtown Warehouse Takeover';
  SELECT id INTO g5 FROM public.gigs WHERE promoter_id = pp2 AND event_name = 'Long Street NYE Block Party';

  INSERT INTO public.gig_applications (gig_id, manager_id, roster_artist_id, quote_cents, currency, availability_notes, rider_notes, message, status) VALUES
    (g1, mm1, a1, 5500000, 'ZAR', 'Confirmed available', 'Standard DJ rider, 2x CDJ-3000, DJM-900.',  'Lerato is available and would love this slot.',            'submitted'),
    (g1, mm1, a2, 7200000, 'ZAR', 'Confirmed available', 'Own controller supplied.',                   'Bandi is closing another JHB show earlier — can headline.','shortlisted'),
    (g2, mm2, a3,12000000, 'ZAR', 'Confirmed available', 'Full club rider, travel from CPT.',          'Sipho is on tour, aligned with this date.',                'submitted'),
    (g5, mm2, a4,22000000, 'ZAR', 'Confirmed available', '5-piece with backline provided by us.',      'CSC would headline main stage.',                           'submitted');
END $$;
