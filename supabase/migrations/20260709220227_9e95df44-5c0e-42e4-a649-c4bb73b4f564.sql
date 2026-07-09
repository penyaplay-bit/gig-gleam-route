
-- Opportunity kind enum
DO $$ BEGIN
  CREATE TYPE public.opportunity_kind AS ENUM ('verified','discovered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS kind public.opportunity_kind NOT NULL DEFAULT 'discovered',
  ADD COLUMN IF NOT EXISTS verified_promoter_id UUID REFERENCES public.promoters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS public_website TEXT,
  ADD COLUMN IF NOT EXISTS public_organizer TEXT,
  ADD COLUMN IF NOT EXISTS public_socials_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ticketing_url TEXT,
  ADD COLUMN IF NOT EXISTS attendance_public INTEGER;

CREATE INDEX IF NOT EXISTS idx_opportunities_kind ON public.opportunities(kind);

-- Territory fields on booking_intents
ALTER TABLE public.booking_intents
  ADD COLUMN IF NOT EXISTS primary_territory TEXT,
  ADD COLUMN IF NOT EXISTS additional_territories TEXT[] NOT NULL DEFAULT '{}';
