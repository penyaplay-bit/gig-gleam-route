ALTER TABLE public.artist_profiles
  ADD COLUMN IF NOT EXISTS home_city TEXT,
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS home_country_code TEXT;

UPDATE public.artist_profiles
  SET home_city = COALESCE(home_city, 'Maseru'),
      home_country_code = COALESCE(home_country_code, 'LS'),
      home_address = COALESCE(home_address, 'Maseru, Lesotho')
  WHERE lower(name) LIKE '%ntate stunna%' OR lower(name) LIKE '%stunna%';

UPDATE public.artist_profiles
  SET home_address = COALESCE(home_address, home_city),
      home_country_code = COALESCE(home_country_code, 'ZA')
  WHERE home_address IS NULL OR home_country_code IS NULL;