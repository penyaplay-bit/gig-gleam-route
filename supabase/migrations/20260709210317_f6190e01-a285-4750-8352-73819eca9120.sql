-- ============ ENUMS ============
CREATE TYPE public.opportunity_category AS ENUM (
  'festival','corporate','government','university','club','lounge',
  'wedding','private','brand','tv','radio','cultural','sports','international','other'
);

CREATE TYPE public.opportunity_status AS ENUM ('active','closed','cancelled','draft');

CREATE TYPE public.deal_stage AS ENUM (
  'discovered','qualified','contact_available','proposal_prepared',
  'proposal_sent','opened','interested','negotiating','contract_sent',
  'deposit_paid','booked','completed','review_collected'
);

CREATE TYPE public.outreach_status AS ENUM ('draft','sent','opened','replied','meeting','negotiating','booked','declined');

CREATE TYPE public.watchlist_cadence AS ENUM ('realtime','daily','weekly');

-- ============ opportunity_sources ============
CREATE TABLE public.opportunity_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL, -- ticketing | municipality | university | venue | manual | api
  url text,
  parser text, -- module slug under src/lib/engine/discovery/sources
  cadence text NOT NULL DEFAULT 'daily',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunity_sources TO authenticated;
GRANT ALL ON public.opportunity_sources TO service_role;
ALTER TABLE public.opportunity_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources read all signed-in" ON public.opportunity_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "sources staff write" ON public.opportunity_sources FOR ALL TO authenticated
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON public.opportunity_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ opportunities ============
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.opportunity_sources(id) ON DELETE SET NULL,
  source_url text,
  dedupe_hash text NOT NULL UNIQUE,
  title text NOT NULL,
  organizer text,
  venue text,
  city text,
  country text,
  start_date date,
  end_date date,
  category public.opportunity_category NOT NULL DEFAULT 'other',
  genres text[] NOT NULL DEFAULT '{}',
  budget_min numeric,
  budget_max numeric,
  currency text DEFAULT 'ZAR',
  audience_estimate integer,
  venue_capacity integer,
  application_deadline date,
  contact_email text,
  contact_phone text,
  description text,
  trust_score integer NOT NULL DEFAULT 50,
  status public.opportunity_status NOT NULL DEFAULT 'active',
  estimates_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opps read signed-in" ON public.opportunities FOR SELECT TO authenticated USING (status = 'active' OR public.is_staff_or_admin());
CREATE POLICY "opps staff write" ON public.opportunities FOR ALL TO authenticated
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE TRIGGER trg_opps_updated BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_opps_start_date ON public.opportunities(start_date);
CREATE INDEX idx_opps_category ON public.opportunities(category);
CREATE INDEX idx_opps_city ON public.opportunities(city);

-- ============ opportunity_ingest_runs ============
CREATE TABLE public.opportunity_ingest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.opportunity_sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  found integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running'
);
GRANT SELECT ON public.opportunity_ingest_runs TO authenticated;
GRANT ALL ON public.opportunity_ingest_runs TO service_role;
ALTER TABLE public.opportunity_ingest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs staff read" ON public.opportunity_ingest_runs FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- ============ promoter_intel ============
CREATE TABLE public.promoter_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  website text,
  primary_venue text,
  city text,
  country text,
  public_email text,
  public_phone text,
  socials_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  genres text[] NOT NULL DEFAULT '{}',
  prior_events_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  scale text, -- small | medium | large | festival
  verified boolean NOT NULL DEFAULT false,
  trust_score integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promoter_intel TO authenticated;
GRANT ALL ON public.promoter_intel TO service_role;
ALTER TABLE public.promoter_intel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promoter_intel read signed-in" ON public.promoter_intel FOR SELECT TO authenticated USING (true);
CREATE POLICY "promoter_intel staff write" ON public.promoter_intel FOR ALL TO authenticated
  USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE TRIGGER trg_promoter_intel_updated BEFORE UPDATE ON public.promoter_intel
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ booking_intents ============
CREATE TABLE public.booking_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_owner_id uuid, -- refs artist_owner_profiles.id, but nullable to avoid hard coupling
  roles text[] NOT NULL DEFAULT '{}', -- ['self'] or ['manager']
  categories public.opportunity_category[] NOT NULL DEFAULT '{}',
  fee_min numeric,
  fee_max numeric,
  fee_currency text DEFAULT 'ZAR',
  min_acceptable numeric,
  geo_scope text NOT NULL DEFAULT 'anywhere_lesotho', -- my_city | province | anywhere_lesotho | south_africa | southern_africa | africa | worldwide
  travel_ok boolean NOT NULL DEFAULT false,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_intents TO authenticated;
GRANT ALL ON public.booking_intents TO service_role;
ALTER TABLE public.booking_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intents owner all" ON public.booking_intents FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "intents staff read" ON public.booking_intents FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE TRIGGER trg_intents_updated BEFORE UPDATE ON public.booking_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ watchlists ============
CREATE TABLE public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_owner_id uuid,
  name text NOT NULL,
  criteria_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  cadence public.watchlist_cadence NOT NULL DEFAULT 'daily',
  channels text[] NOT NULL DEFAULT '{in_app,email}',
  last_notified_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlists owner all" ON public.watchlists FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_watchlists_updated BEFORE UPDATE ON public.watchlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ match_scores ============
CREATE TABLE public.match_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_owner_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  score integer NOT NULL,
  subscores_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  checks_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_owner_id, opportunity_id)
);
GRANT SELECT ON public.match_scores TO authenticated;
GRANT ALL ON public.match_scores TO service_role;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_scores read signed-in" ON public.match_scores FOR SELECT TO authenticated USING (true);

-- ============ booking_deals ============
CREATE TABLE public.booking_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_owner_id uuid,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  stage public.deal_stage NOT NULL DEFAULT 'discovered',
  value_estimate numeric,
  currency text DEFAULT 'ZAR',
  notes text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_deals TO authenticated;
GRANT ALL ON public.booking_deals TO service_role;
ALTER TABLE public.booking_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals owner all" ON public.booking_deals FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "deals staff read" ON public.booking_deals FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON public.booking_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ deal_events ============
CREATE TABLE public.deal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.booking_deals(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deal_events TO authenticated;
GRANT ALL ON public.deal_events TO service_role;
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_events owner read" ON public.deal_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.booking_deals d WHERE d.id = deal_events.deal_id AND d.owner_id = auth.uid()));
CREATE POLICY "deal_events owner insert" ON public.deal_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.booking_deals d WHERE d.id = deal_events.deal_id AND d.owner_id = auth.uid()));

-- ============ outreach_messages ============
CREATE TABLE public.outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.booking_deals(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  status public.outreach_status NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_messages TO authenticated;
GRANT ALL ON public.outreach_messages TO service_role;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outreach owner all" ON public.outreach_messages FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_outreach_updated BEFORE UPDATE ON public.outreach_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ai_briefs ============
CREATE TABLE public.ai_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_owner_id uuid,
  brief_date date NOT NULL,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, artist_owner_id, brief_date)
);
GRANT SELECT ON public.ai_briefs TO authenticated;
GRANT ALL ON public.ai_briefs TO service_role;
ALTER TABLE public.ai_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefs owner read" ON public.ai_briefs FOR SELECT TO authenticated USING (owner_id = auth.uid());