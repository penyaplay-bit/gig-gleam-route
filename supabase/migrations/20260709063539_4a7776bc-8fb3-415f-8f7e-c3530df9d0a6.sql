ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS home_address text;
UPDATE public.artists SET home_address = '8G Riversands Blvd, Fourways, Johannesburg, South Africa', home_city = 'Fourways' WHERE slug = 'ntate-stunna';
UPDATE public.artists SET home_address = COALESCE(home_address, home_city) WHERE home_address IS NULL;