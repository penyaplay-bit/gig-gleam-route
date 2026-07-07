
# Decision Engine + Full Event Workspace Surfaces

Build the Operating Brain and wire every workspace surface to it in one phase. Mission Control dashboard stays deferred (it becomes a trivial consumer once the engine exists).

## Principle

```text
Event Graph
   ↓
Decision Engine        (single source of truth)
   ↓
Event Workspace: Pulse header · Pillar breakdown · NBA card · Prediction · Decision-driven timeline
   ↓ (later)
Mission Control / AI COO / WhatsApp / Campaign
```

No consumer ever computes its own health, risk, or recommendation. It only reads.

---

## 1. Data model (one migration)

Table `event_health` (1:1 with `bookings`, upserted on each evaluation):

- `event_id` pk / fk → bookings
- `health_score` int 0–100
- `risk_level` enum `green | yellow | red | black`
- `pulse` enum mirrors risk (present so UI code never derives it)
- `financial_lock` enum `none | pending | cleared | broken | default`
- `pillar_scores` jsonb — `financial, logistics, marketing, legal, communication, talent` each 0–100
- `factors` jsonb — `[{ code, label, delta, category, active }]`
- `next_best_action` jsonb — `{ code, label, reason, cta_route, cta_label, urgency }`
- `predicted_failure_pct` int 0–100
- `predicted_reasons` jsonb — top 3 negative drivers
- `evaluated_at` timestamptz
- `stale` bool

Table `event_health_history` (append-only, small):
- id, event_id, health_score, risk_level, pillar_scores, snapshot_at
- One row inserted per evaluation ONLY when score or risk changes. Powers the Pulse trend sparkline.

Trigger `mark_event_health_stale()` flips `stale = true` on writes to: `bookings`, `event_payments`, `event_logistics`, `event_contracts`, `event_campaign`, `event_documents`, `event_parties`, `event_tasks`, `event_overrides`.

Grants: `SELECT` to `authenticated`, `ALL` to `service_role`. RLS: staff/admin read all, promoter reads own event's health. History table: staff/admin only.

Realtime enabled on `event_health`.

## 2. Engine module

`src/lib/engines/decision.functions.ts`, deterministic and testable.

Exports:
- `evaluateEvent(eventId)` — reads graph, computes state, upserts `event_health`, inserts history row on change, appends `event_timeline` entry when `risk_level` or `next_best_action` changes.
- `evaluateStale(limit)` — batch, driven by cron.
- `evaluateAll()` — nightly sweep for time-based transitions.
- `getEventHealth(eventId)`, `getEventHealthHistory(eventId, days)`, `listEventHealth(filter)` — typed read helpers.

Factor registry (single source of weights, exported as read-only for the UI legend):

```ts
export const FACTORS = [
  { code: 'deposit_paid',        weight: +20, category: 'financial'     },
  { code: 'balance_paid',        weight: +20, category: 'financial'     },
  { code: 'contract_signed',     weight: +10, category: 'legal'         },
  { code: 'artist_confirmed',    weight: +10, category: 'talent'        },
  { code: 'logistics_ready',     weight: +15, category: 'logistics'     },
  { code: 'campaign_running',    weight:  +5, category: 'marketing'     },
  { code: 'documents_complete',  weight:  +5, category: 'legal'         },
  { code: 'weather_risk',        weight:  -5, category: 'logistics'     },
  { code: 'hotel_missing',       weight: -10, category: 'logistics'     },
  { code: 'driver_missing',      weight: -10, category: 'logistics'     },
  { code: 't7_lock_broken',      weight: -30, category: 'financial'     },
  { code: 'promoter_silent_72h', weight: -10, category: 'communication' },
];
```

Score clamped 0–100. Bands: `>=80 green`, `60–79 yellow`, `40–59 red`, `<40 or default black`. Pillar scores = normalized sum of that category's active factor deltas over that category's positive-weight max.

Next Best Action (first-match, deterministic):
1. payment_default → escalate override
2. t7_lock_broken → collect final balance
3. deposit_pending & event ≤14d → chase deposit
4. contract_unsigned & deposit paid → send contract
5. hotel_missing & ≤10d → assign hotel
6. driver_missing & ≤10d → assign driver
7. campaign_not_started & ≤21d → launch campaign
8. promoter_silent_72h → reach out
9. else → on track

Each NBA carries a `cta_route` deep-linking into the correct workspace tab and a plain-English `reason`.

Predicted failure %: weighted sum of active negatives, capped 0–100, top 3 returned as `predicted_reasons`. Deterministic heuristic in v1; swappable for a model later without consumer changes.

## 3. Scheduling

Server route `src/routes/api/public/cron/decision-engine.ts` authenticated via `apikey` header.
- Every 5 min: `evaluateStale(200)`
- 03:00 daily: `evaluateAll()`
- Realtime pushes fresh rows to any open workspace.

## 4. Event workspace surfaces (all in `admin.events.$id.tsx`)

All fed by `getEventHealth` + `getEventHealthHistory`. No local logic.

**Pulse header strip** (always visible above tabs):
- Left: large pulse dot (green/yellow/red/black), event title, date, days-to-event.
- Center: `Health XX / 100` big number + risk band label + tiny 14-day sparkline from history.
- Right: financial lock badge (`Cleared | Pending | Locked | Default`) + prediction chip (`Failure risk 76%` when ≥50%).
- Under the strip: single Next Best Action card — reason line + primary CTA button navigating to the linked tab.

**Pillar breakdown panel** (new tab: "Health"):
- Six horizontal bars: Financial, Logistics, Marketing, Legal, Communication, Talent, each with score + trend arrow vs. yesterday.
- Below: active factors list, grouped by category, each row showing label, ±delta, and a "Fix this" link routing to the responsible tab.
- Prediction section: `Predicted failure: XX%` gauge + bullet list of top 3 negative drivers.

**Decision-driven timeline entries** in existing Timeline tab: engine writes a `kind: 'decision'` event whenever risk band shifts or NBA changes, so history explains WHY status moved.

**Payments tab reconciliation**: replace hand-rolled financial-state derivation in the header with the engine's `financial_lock` so both agree byte-for-byte. Existing `getFinancialState` remains for detail computations; the badge is engine-driven.

Realtime hookup: workspace subscribes to `event_health` filtered by `event_id`, invalidating the two queries on update.

## 5. Out of scope

- Mission Control redesign (next phase — will list events sorted by risk, using `listEventHealth` only).
- AI COO chat, WhatsApp send, campaign automation — all future consumers.
- ML model for predictions — deterministic heuristic in v1.
- Weather API — `weather_risk` factor stays inactive until a source is wired.
- Cross-event trend charts (only per-event sparkline in v1).

## Technical section

- Migration order per public table: CREATE → GRANT → ENABLE RLS → CREATE POLICY. `event_health` and `event_health_history` both included.
- Engine lives in `src/lib/engines/decision.functions.ts` (client-safe wrappers with `requireSupabaseAuth`) + `decision.server.ts` for the heavy read query used by cron with the server publishable client + narrow policy.
- Cron route uses `apikey` header pattern (no custom secret), calls `evaluateStale` / `evaluateAll` scheduled via `supabase--insert` after route deploys.
- Realtime: `alter publication supabase_realtime add table public.event_health`.
- Consumers use `useSuspenseQuery(getEventHealth(eventId))` + `useEffect` channel subscription that calls `queryClient.invalidateQueries`.
- Timeline decision entries written inside the engine transaction to guarantee consistency.
- Factor registry exported from a shared module and consumed by both the engine and the pillar UI legend so labels never drift.
