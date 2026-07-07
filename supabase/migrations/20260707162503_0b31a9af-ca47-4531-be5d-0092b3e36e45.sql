
-- ============================================================================
-- PENYA LIVE — EVENT GRAPH FOUNDATION
-- Every satellite table references bookings(id) as event_id.
-- An existing booking IS an event in v1; a future rename to `events` will be
-- a pure alias since the id column is preserved.
-- ============================================================================

-- ------------------------------------------------------------------
-- 1. event_timeline — append-only status/audit log
-- ------------------------------------------------------------------
CREATE TABLE public.event_timeline (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  stage text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_timeline_event_id_idx ON public.event_timeline(event_id, at DESC);
CREATE INDEX event_timeline_stage_idx ON public.event_timeline(stage);

GRANT SELECT ON public.event_timeline TO authenticated;
GRANT ALL ON public.event_timeline TO service_role;
ALTER TABLE public.event_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view timeline" ON public.event_timeline
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins insert timeline" ON public.event_timeline
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
-- append-only: no UPDATE / DELETE policies

-- ------------------------------------------------------------------
-- 2. event_parties — everyone attached to an event
-- ------------------------------------------------------------------
CREATE TABLE public.event_parties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('talent','promoter','sponsor','crew','venue','client')),
  party_type text,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  promoter_id uuid REFERENCES public.promoters(id) ON DELETE SET NULL,
  name text,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_parties_event_id_idx ON public.event_parties(event_id);
CREATE INDEX event_parties_role_idx ON public.event_parties(event_id, role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_parties TO authenticated;
GRANT ALL ON public.event_parties TO service_role;
ALTER TABLE public.event_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view parties" ON public.event_parties
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage parties" ON public.event_parties
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 3. event_quotes — versioned quotes
-- ------------------------------------------------------------------
CREATE TABLE public.event_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  subtotal_lsl integer NOT NULL DEFAULT 0,
  total_lsl integer NOT NULL DEFAULT 0,
  deposit_pct integer NOT NULL DEFAULT 50,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_quotes_event_id_idx ON public.event_quotes(event_id, version DESC);
CREATE TRIGGER event_quotes_updated_at BEFORE UPDATE ON public.event_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_quotes TO authenticated;
GRANT ALL ON public.event_quotes TO service_role;
ALTER TABLE public.event_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view quotes" ON public.event_quotes
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage quotes" ON public.event_quotes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 4. event_contracts
-- ------------------------------------------------------------------
CREATE TABLE public.event_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  document_id uuid,
  status text NOT NULL DEFAULT 'draft',
  signer_name text,
  signer_email text,
  signed_at timestamptz,
  storage_path text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_contracts_event_id_idx ON public.event_contracts(event_id);
CREATE TRIGGER event_contracts_updated_at BEFORE UPDATE ON public.event_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_contracts TO authenticated;
GRANT ALL ON public.event_contracts TO service_role;
ALTER TABLE public.event_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view contracts" ON public.event_contracts
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage contracts" ON public.event_contracts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 5. event_payments — deposits, balances, refunds, invoices
-- ------------------------------------------------------------------
CREATE TABLE public.event_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('deposit','balance','refund','invoice','other')),
  amount_lsl integer NOT NULL,
  currency text NOT NULL DEFAULT 'LSL',
  method text,
  reference text,
  pop_path text,
  status text NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_payments_event_id_idx ON public.event_payments(event_id, created_at DESC);
CREATE INDEX event_payments_status_idx ON public.event_payments(status);
CREATE TRIGGER event_payments_updated_at BEFORE UPDATE ON public.event_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_payments TO authenticated;
GRANT ALL ON public.event_payments TO service_role;
ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view payments" ON public.event_payments
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage payments" ON public.event_payments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 6. event_logistics — travel, hotel, driver, rider, distance
-- ------------------------------------------------------------------
CREATE TABLE public.event_logistics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  travel jsonb NOT NULL DEFAULT '{}'::jsonb,
  hotel jsonb NOT NULL DEFAULT '{}'::jsonb,
  driver jsonb NOT NULL DEFAULT '{}'::jsonb,
  rider jsonb NOT NULL DEFAULT '{}'::jsonb,
  distance_km numeric,
  call_sheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER event_logistics_updated_at BEFORE UPDATE ON public.event_logistics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_logistics TO authenticated;
GRANT ALL ON public.event_logistics TO service_role;
ALTER TABLE public.event_logistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view logistics" ON public.event_logistics
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage logistics" ON public.event_logistics
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 7. event_campaign — 30/14/7/1-day promo schedule
-- ------------------------------------------------------------------
CREATE TABLE public.event_campaign (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  phase text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  template text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_campaign_event_id_idx ON public.event_campaign(event_id, scheduled_at);
CREATE INDEX event_campaign_status_idx ON public.event_campaign(status, scheduled_at);
CREATE TRIGGER event_campaign_updated_at BEFORE UPDATE ON public.event_campaign
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_campaign TO authenticated;
GRANT ALL ON public.event_campaign TO service_role;
ALTER TABLE public.event_campaign ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view campaign" ON public.event_campaign
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage campaign" ON public.event_campaign
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 8. event_media — photos and videos
-- ------------------------------------------------------------------
CREATE TABLE public.event_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo','video','audio','other')),
  url text NOT NULL,
  storage_path text,
  caption text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_media_event_id_idx ON public.event_media(event_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_media TO authenticated;
GRANT ALL ON public.event_media TO service_role;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view media" ON public.event_media
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage media" ON public.event_media
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 9. event_messages — unified chat thread (channel-agnostic)
-- ------------------------------------------------------------------
CREATE TABLE public.event_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','whatsapp','email','sms','other')),
  direction text NOT NULL DEFAULT 'out' CHECK (direction IN ('in','out','internal')),
  kind text NOT NULL DEFAULT 'message' CHECK (kind IN ('message','note','system')),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_messages_event_id_idx ON public.event_messages(event_id, created_at DESC);
CREATE INDEX event_messages_channel_idx ON public.event_messages(channel);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_messages TO authenticated;
GRANT ALL ON public.event_messages TO service_role;
ALTER TABLE public.event_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view messages" ON public.event_messages
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Staff insert messages" ON public.event_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin() AND (author_id IS NULL OR author_id = auth.uid()));
CREATE POLICY "Admins manage messages" ON public.event_messages
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 10. event_tasks
-- ------------------------------------------------------------------
CREATE TABLE public.event_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_tasks_event_id_idx ON public.event_tasks(event_id, status);
CREATE TRIGGER event_tasks_updated_at BEFORE UPDATE ON public.event_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_tasks TO authenticated;
GRANT ALL ON public.event_tasks TO service_role;
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view tasks" ON public.event_tasks
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage tasks" ON public.event_tasks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 11. event_documents — quotes, contracts, invoices, call sheets, POPs
-- ------------------------------------------------------------------
CREATE TABLE public.event_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('quote','contract','invoice','callsheet','pop','rider','other')),
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime text,
  size integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_documents_event_id_idx ON public.event_documents(event_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_documents TO authenticated;
GRANT ALL ON public.event_documents TO service_role;
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view documents" ON public.event_documents
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage documents" ON public.event_documents
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------
-- 12. notifications — rule-based reminders
-- ------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  rule text NOT NULL,
  target_role text NOT NULL DEFAULT 'admin',
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','critical')),
  title text NOT NULL,
  body text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  read_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_unread_idx ON public.notifications(target_role, created_at DESC) WHERE read_at IS NULL;
CREATE UNIQUE INDEX notifications_dedupe_idx ON public.notifications(rule, event_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Staff mark read" ON public.notifications
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- BACKFILL
-- ============================================================================

-- Timeline: one 'created' entry per existing booking, plus one for current status
INSERT INTO public.event_timeline (event_id, stage, actor_id, payload, at)
SELECT id, 'created', NULL, jsonb_build_object('ref', ref, 'source', 'backfill'), created_at
FROM public.bookings;

INSERT INTO public.event_timeline (event_id, stage, actor_id, payload, at)
SELECT id, status::text, NULL, jsonb_build_object('source', 'backfill'), updated_at
FROM public.bookings
WHERE status::text <> 'new';

-- Parties: derive from bookings.artist_id + promoter_id
INSERT INTO public.event_parties (event_id, role, artist_id, name, contact, created_at)
SELECT b.id, 'talent', b.artist_id, a.name, '{}'::jsonb, b.created_at
FROM public.bookings b JOIN public.artists a ON a.id = b.artist_id;

INSERT INTO public.event_parties (event_id, role, promoter_id, name, contact, created_at)
SELECT b.id, 'promoter', b.promoter_id, COALESCE(p.name, b.contact_name),
       jsonb_build_object('email', COALESCE(p.email, b.contact_email), 'phone', COALESCE(p.phone, b.contact_phone), 'whatsapp', COALESCE(p.whatsapp, b.contact_whatsapp)),
       b.created_at
FROM public.bookings b LEFT JOIN public.promoters p ON p.id = b.promoter_id
WHERE b.promoter_id IS NOT NULL;

INSERT INTO public.event_parties (event_id, role, name, contact, created_at)
SELECT b.id, 'client', b.contact_name,
       jsonb_build_object('email', b.contact_email, 'phone', b.contact_phone, 'whatsapp', b.contact_whatsapp, 'preferred', b.preferred_contact),
       b.created_at
FROM public.bookings b WHERE b.promoter_id IS NULL;

-- Quotes: copy from bookings.quote_breakdown where present
INSERT INTO public.event_quotes (event_id, version, subtotal_lsl, total_lsl, deposit_pct, breakdown, status, created_at)
SELECT id, 1,
       COALESCE(quoted_amount, 0),
       COALESCE(quoted_amount, 0),
       deposit_pct,
       COALESCE(quote_breakdown, '{}'::jsonb),
       'sent',
       updated_at
FROM public.bookings WHERE quoted_amount IS NOT NULL;

-- Payments: copy existing deposits
INSERT INTO public.event_payments (event_id, kind, amount_lsl, method, reference, pop_path, status, uploaded_at, verified_at, verified_by, created_at)
SELECT d.booking_id, 'deposit', d.amount, d.method, d.reference, d.pop_path,
       CASE d.status::text WHEN 'verified' THEN 'verified' WHEN 'rejected' THEN 'rejected' ELSE 'uploaded' END,
       d.uploaded_at, d.verified_at, d.verified_by, d.created_at
FROM public.deposits d;

-- Messages: copy existing booking_notes as internal notes
INSERT INTO public.event_messages (event_id, channel, direction, kind, author_id, body, meta, created_at)
SELECT booking_id, 'in_app', 'internal', 'note', author_id, body,
       jsonb_build_object('backfilled_from', 'booking_notes', 'internal', internal),
       created_at
FROM public.booking_notes;

-- ============================================================================
-- REALTIME — enable for the live Operating Room
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_timeline;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_payments;
