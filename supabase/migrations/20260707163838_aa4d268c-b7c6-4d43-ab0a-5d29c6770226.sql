
-- ============================================================================
-- PAYMENT PROTECTION POLICY — 7-Day Financial Lock
-- ============================================================================

-- 1. Hold status columns on payments (artist protection)
ALTER TABLE public.event_payments
  ADD COLUMN hold_status text NOT NULL DEFAULT 'released'
    CHECK (hold_status IN ('released','held','released_partial')),
  ADD COLUMN release_reason text,
  ADD COLUMN released_at timestamptz,
  ADD COLUMN released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Management overrides log
CREATE TABLE public.event_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('extend_deadline','approve_continuation','cancel','escalate_legal')),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  new_deadline date,
  notes text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_overrides_event_id_idx ON public.event_overrides(event_id, created_at DESC);
CREATE INDEX event_overrides_active_idx ON public.event_overrides(event_id, kind) WHERE active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_overrides TO authenticated;
GRANT ALL ON public.event_overrides TO service_role;
ALTER TABLE public.event_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view overrides" ON public.event_overrides
  FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY "Admins manage overrides" ON public.event_overrides
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Derived financial state view — always fresh, no sync bugs
CREATE OR REPLACE VIEW public.event_financial_state
WITH (security_invoker = true)
AS
WITH totals AS (
  SELECT
    b.id AS event_id,
    b.event_date,
    b.ref,
    COALESCE(
      (SELECT total_lsl FROM public.event_quotes q
        WHERE q.event_id = b.id ORDER BY version DESC LIMIT 1),
      b.quoted_amount,
      0
    )::int AS total_due_lsl,
    COALESCE(
      (SELECT SUM(amount_lsl) FROM public.event_payments p
        WHERE p.event_id = b.id AND p.status = 'verified' AND p.kind IN ('deposit','balance')),
      0
    )::int AS paid_lsl,
    (b.event_date - INTERVAL '7 days')::date AS balance_due_on,
    (b.event_date - CURRENT_DATE) AS days_to_event,
    ((b.event_date - INTERVAL '7 days')::date - CURRENT_DATE) AS days_to_balance_due,
    (SELECT new_deadline FROM public.event_overrides o
      WHERE o.event_id = b.id AND o.kind = 'extend_deadline' AND o.active
      ORDER BY created_at DESC LIMIT 1) AS extended_deadline,
    EXISTS (SELECT 1 FROM public.event_overrides o
      WHERE o.event_id = b.id AND o.kind = 'approve_continuation' AND o.active) AS has_continuation,
    EXISTS (SELECT 1 FROM public.event_overrides o
      WHERE o.event_id = b.id AND o.kind = 'cancel' AND o.active) AS is_cancelled
  FROM public.bookings b
)
SELECT
  event_id,
  ref,
  event_date,
  total_due_lsl,
  paid_lsl,
  GREATEST(total_due_lsl - paid_lsl, 0) AS outstanding_lsl,
  COALESCE(extended_deadline, balance_due_on) AS balance_due_on,
  days_to_event,
  ((COALESCE(extended_deadline, balance_due_on)) - CURRENT_DATE) AS days_to_balance_due,
  has_continuation,
  is_cancelled,
  CASE
    WHEN is_cancelled THEN 'cancelled'
    WHEN paid_lsl >= total_due_lsl AND total_due_lsl > 0 THEN 'financially_cleared'
    WHEN paid_lsl = 0 THEN 'awaiting_deposit'
    WHEN paid_lsl < total_due_lsl AND (COALESCE(extended_deadline, balance_due_on)) < CURRENT_DATE
      AND NOT has_continuation THEN 'payment_default'
    WHEN paid_lsl >= (total_due_lsl / 2) THEN 'balance_pending'
    ELSE 'deposit_paid'
  END AS financial_state,
  ((COALESCE(extended_deadline, balance_due_on)) - CURRENT_DATE) <= 7
    AND ((COALESCE(extended_deadline, balance_due_on)) - CURRENT_DATE) >= 0
    AS lock_active
FROM totals;

GRANT SELECT ON public.event_financial_state TO authenticated;
GRANT SELECT ON public.event_financial_state TO service_role;
