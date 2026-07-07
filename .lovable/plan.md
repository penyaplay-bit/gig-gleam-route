# Decision Engine + Event Workspace Surfaces

Build the Operating Brain before any Mission Control redesign. Every future module (Mission Control, AI COO, WhatsApp, Campaigns, Live Operating Room) will consume this engine instead of implementing its own logic.

## Principle

```text
Event Graph → Decision Engine (single source of truth)
            → Event Workspace: Pulse + Pillars + NBA + Prediction
            → later: Mission Control / AI / WhatsApp / Campaign
```

Screens never compute health, risk, or recommendations. They read them.

## Data model

**`event_health`** (1:1 with `bookings`, upserted on each evaluation)
- `health_score` 0–100
- `risk_level` green | yellow | red | black
- `pulse` mirrors risk (semantic alias for UI)
- `financial_lock` none | pending | cleared | broken | default
- `pillar_scores` jsonb: financial, logistics, marketing, legal, communication, artist (0–100 each)
- `factors` jsonb: array of `{ key, weight, active, detail }`
- `next_best_action` jsonb: `{ code, label, cta_route, priority, reason }` — exactly one
- `predicted_failure_pct` 0–100
- `predicted_reasons` jsonb array
- `evaluated_at`, `stale` boolean

**`event_health_history`** (append-only) — powers sparkline + prediction trend.

Both tables get RLS scoped to the same audience as `bookings` + `service_role` for the engine.

## Deterministic factor set (v1)

| Factor | Weight |
|---|---|
| deposit_paid | +20 |
| balance_paid | +20 |
| contract_signed | +10 |
| artist_confirmed | +10 |
| logistics_ready | +15 |
| campaign_running | +5 |
| documents_complete | +5 |
| weather_risk | -5 |
| hotel_missing | -10 |
| driver_missing | -10 |
| t7_lock_broken | -30 |
| promoter_silent_72h | -10 |

Score clamped 0–100. Risk bands: ≥80 green, 60–79 yellow, 40–59 red, <40 or financial_lock=default → black.

## Engine (`src/lib/engines/decision.functions.ts` + `decision.server.ts`)

Server functions (all `requireSupabaseAuth` + role check where privileged):
- `evaluateEvent(eventId)` — recompute + upsert + append history
- `evaluateStale(limit=200)` — every 5 min via cron
- `evaluateAll()` — nightly 03:00 via cron
- `getEventHealth(eventId)`, `getEventHealthHistory(eventId)`, `listEventHealth(filter)`

NBA rules evaluated first-match, priority order:
1. `payment_default` → Collect balance now
2. `t7_lock_broken` → Escalate to Edward
3. `deposit_missing` → Chase deposit
4. `contract_missing` → Send contract
5. `hotel_missing` / `driver_missing` → Assign logistics
6. `campaign_not_started` → Launch campaign
7. `promoter_silent_72h` → Reach out
8. default → On track

Staleness: DB triggers on `bookings`, `event_payments`, `event_contracts`, `event_logistics`, `event_campaign`, `event_parties` mark `event_health.stale=true`; the 5-min cron re-evaluates stale rows.

## Cron

Two `/api/public/hooks/*` routes secured with `apikey` header, wired via `pg_cron` + `pg_net`:
- `evaluate-stale` — every 5 min
- `evaluate-all` — daily 03:00

## Workspace surfaces (this phase)

All rendered inside the existing event workspace, all read `event_health` with Realtime auto-refresh.

1. **Pulse header strip** — colored dot + `health_score` + risk band label + 14-day sparkline + financial-lock chip + prediction chip.
2. **Health tab / Pillar panel** — 6 horizontal bars (financial, logistics, marketing, legal, communication, artist), active-factors list with "Fix this" deep links to the right tab, predicted-failure % + reasons.
3. **Next Best Action card** — one action, prominent CTA button routing to the fix.
4. **Decision-driven timeline** — new `kind: 'decision'` timeline entries appended when risk band or NBA changes.
5. **Payments tab** — reconciled with engine's `financial_lock` so the badge matches the pulse.

## Out of scope this phase

Mission Control redesign, AI COO copy generation, WhatsApp automation, campaign automation, real ML prediction (v1 prediction is deterministic from trajectory + active negative factors), weather API, cross-event trend charts. All become trivial once the engine exists.

## Technical notes

- Engine is pure functions over booking + related tables; no external calls.
- Prediction v1: linear extrapolation of last 5 history points + penalty for each active negative factor.
- History write is idempotent per (event_id, evaluated_at minute bucket).
- All writes go through `service_role` inside server fns; clients only read.
- Realtime channel on `event_health` filtered by `event_id` in the workspace.