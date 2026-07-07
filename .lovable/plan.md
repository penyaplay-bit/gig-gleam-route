
# Payment Protection Policy — the 7-Day Financial Lock

Turn the policy you wrote into a first-class engine inside the Event Graph. Every booking automatically runs the same reminder cadence, flips to `payment_default` after the deadline, freezes downstream work, and forces a logged Management Override to continue. The artist fee is held separately from logistics reimbursements.

No new module. Everything plugs into the tables we shipped last turn: `event_payments`, `event_timeline`, `notifications`, `event_campaign`.

---

## Schema additions (one small migration)

```sql
-- Store the policy result as derived state, not a snowflake column on bookings
CREATE VIEW public.event_financial_state AS
SELECT
  b.id AS event_id,
  b.event_date,
  COALESCE(q.total_lsl, b.quoted_amount, 0)                    AS total_due_lsl,
  COALESCE(SUM(p.amount_lsl) FILTER (WHERE p.status='verified' AND p.kind IN ('deposit','balance')), 0) AS paid_lsl,
  (b.event_date - INTERVAL '7 days')::date                     AS balance_due_on,
  (b.event_date - CURRENT_DATE)                                AS days_to_event,
  ((b.event_date - INTERVAL '7 days')::date - CURRENT_DATE)    AS days_to_balance_due,
  -- financial_state: awaiting_deposit | deposit_paid | balance_pending | financially_cleared | payment_default
  ...
FROM bookings b LEFT JOIN event_payments p ... LEFT JOIN LATERAL (latest quote) q ...;

-- Management overrides — every extension / continuation / cancel is logged
CREATE TABLE public.event_overrides (
  id, event_id → bookings, kind ('extend_deadline','approve_continuation','cancel','escalate_legal'),
  approved_by uuid → auth.users, reason text NOT NULL, new_deadline date, notes text,
  meta jsonb, created_at
);

-- Artist fee release tracking — sits on event_payments via new columns
ALTER TABLE event_payments
  ADD COLUMN hold_status text NOT NULL DEFAULT 'released'  -- released | held | released_partial
    CHECK (hold_status IN ('released','held','released_partial')),
  ADD COLUMN release_reason text,
  ADD COLUMN released_at timestamptz,
  ADD COLUMN released_by uuid REFERENCES auth.users(id);
```

RLS: staff read, admin write. GRANTs per template.

## Payments Engine — `src/lib/engines/payments.functions.ts`

Pure business logic, no UI. Every action writes a timeline row so the workspace picks it up automatically.

- `getFinancialState(eventId)` — reads the view; returns `{ state, total_due, paid, balance, balance_due_on, days_to_due, lock_active, is_defaulted, override? }`
- `recordPayment({ eventId, kind, amount, method, reference, pop_path })` — inserts `event_payments`, timeline `deposit_paid` / `balance_paid` when verified
- `verifyPayment({ paymentId })` / `rejectPayment({ paymentId, reason })` — admin action, timeline + notification
- `extendDeadline({ eventId, newDeadline, reason })` — writes `event_overrides`, timeline `deadline_extended`
- `approveContinuation({ eventId, reason })` — required to unblock a defaulted event, timeline `override_approve_continuation`, unfreezes logistics
- `cancelForNonPayment({ eventId, reason })` — timeline `cancelled_non_payment`
- `releaseArtistFee({ paymentId, reason })` — flips `hold_status`, records who/when
- `releaseLogisticsCosts({ eventId })` — marks approved logistics reimbursements released even while performance fee is held

Guardrails built in:
- `verifyPayment` on a deposit → auto-advance stage `deposit_paid` → `confirmed`
- `verifyPayment` on the balance covering 100% → stage `financially_cleared`
- Any mutation on a defaulted event without an `approve_continuation` override throws — logistics/campaign engines call `assertNotFrozen(eventId)` first

## Automated Timeline (pg_cron every hour, idempotent)

New server route `src/routes/api/public/cron/payment-reminders.ts`, apikey-auth per the standard pattern. On each run:

1. Query view for events `event_date >= today`.
2. For each event, compute today's bucket relative to `balance_due_on`:
   - `T-21` → notification `reminder_21d` (green), WhatsApp deep link message logged to `event_messages`
   - `T-14` → `reminder_14d` (green)
   - `T-10` → `reminder_10d` (amber)
   - `T-7`  → `reminder_final_notice` (red) + timeline `financial_lock_engaged`
   - `T<0` and not cleared and no active override → timeline `payment_default`, notification `payment_default` (critical), freeze logistics (`event_logistics.meta.frozen=true`), pause campaign (mark `event_campaign` rows `paused`)
3. Every notification is deduped by `(rule, event_id)` — the unique partial index we already have.
4. A separate daily-6am cron runs the same route with `?mode=daily` so timing is guaranteed even if hourly runs miss.

Reminder copy is a small template registry in `src/lib/engines/payment-templates.ts` (5 templates, plain strings with `{event}`, `{amount}`, `{due_date}` placeholders). The comms engine turns them into WA links.

## Event Workspace — Payments tab rebuild

Replaces the current placeholder-heavy Payments tab. Sections:

1. **Financial state banner** — big status pill: 🟡 Awaiting Deposit / 🟢 Financially Cleared / 🟠 Reminder / 🔴 Payment Default. Shows `Balance due in N days` (tabular-nums, gold), total / paid / outstanding.
2. **7-Day Financial Lock strip** — visible countdown once inside `T-7`. Turns red at `T-0`. Explains "Lock engaged: only Management Override can continue."
3. **Payment ledger** — existing list, now with kind, `hold_status` badge, verify / reject actions.
4. **Reminder log** — timeline of the 21/14/10/7-day notices with their sent state, so ops can see what the promoter has actually received.
5. **Management Override panel** (admin only) — three actions: Extend deadline (date + reason), Approve continuation (reason required), Cancel booking. Renders the audit trail below.
6. **Artist Protection block** — shows performance-fee `hold_status` with "Release fee" button (requires event to be `performance_finished`), plus a separate "Release logistics costs" button for pre-event travel/hotel reimbursements.

Copy uses your policy verbatim on the banner and lock strip so promoters see the same words admins see.

## Public `/pay/$ref` upgrade

Same financial-state banner + copy. Three CTAs when inside the final window: **Pay Balance** (opens existing pay flow), **Upload Proof of Payment** (existing POP flow), **Contact Finance** (WA deep link built by comms engine). Green/amber/red bar mirrors the admin view so promoters cannot claim confusion.

## Deliverable checklist

- [ ] Migration: `event_financial_state` view, `event_overrides` table + RLS/GRANTs, `event_payments` hold-status columns
- [ ] `src/lib/engines/payments.functions.ts` — 8 typed server functions listed above
- [ ] `src/lib/engines/payment-templates.ts` — 5 reminder templates
- [ ] `src/routes/api/public/cron/payment-reminders.ts` — hourly + daily runner, apikey-auth
- [ ] pg_cron schedule (insert tool, per rules) — hourly + daily-6am jobs
- [ ] Rewrite Payments tab in `admin.events.$id.tsx` with the six sections above
- [ ] Update `/pay/$ref` with financial-state banner and three CTAs
- [ ] Freeze hooks: logistics/campaign engines call `assertNotFrozen()` before mutations
- [ ] Backfill: seed `hold_status='held'` on any historical performance-fee payments (there won't be any; safe no-op)

## Out of scope for this turn

- Card/mobile-money payment gateway (still POP-based; existing pay flow untouched apart from copy)
- WhatsApp API sending (still `wa.me` deep links via comms engine adapter)
- Automatic legal escalation workflow — the override kind exists, but "escalate_legal" is just a logged status this turn
- Finance ledger / invoicing PDFs — separate turn

## Technical notes

- View not a table → `event_financial_state` is always fresh, no sync bugs, no triggers to maintain.
- The cron route uses the anon key in `apikey` header per template rules; no custom secret.
- All monetary values stay `integer` LSL. Display uses existing `formatM` helper.
- The `assertNotFrozen()` gate is one server-side helper that reads `event_overrides` and the frozen flag; any future engine automatically inherits the policy by calling it.
- Every state change goes through `advanceStage()` — the Timeline tab in the workspace visualises the whole policy for free.

Approve to ship in one turn: migration first, then the engine + cron + UI in the same batch.
