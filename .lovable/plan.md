
# Penya Live — Event-Centric Foundation

Stop adding features. Rebuild the core so **every** object in the system hangs off one entity: **Event**. Talent, promoters, finance, logistics, marketing, AI, campaigns, docs, chat — all become facets of an Event, not standalone modules. This is a foundation turn: no new user-facing features, but every future feature plugs in with zero re-plumbing.

The current `bookings` table already tries to be an event, but it mixes 40 columns of promoter/finance/logistics/scoring concerns into one row. We split it into a graph and rebuild the admin around a single Event workspace.

---

## The Event Graph (data model)

Central table `events` (renamed conceptually from `bookings`), plus one satellite table per concern. Every satellite has `event_id` FK. Nothing new lives outside this graph.

```text
                         ┌──────────────┐
                         │    events    │  ← the only root entity
                         └──────┬───────┘
       ┌──────────────┬────────┼────────┬──────────────┬──────────────┐
       ▼              ▼        ▼        ▼              ▼              ▼
 event_parties  event_timeline  event_quotes  event_contracts  event_payments
 (role=talent/  (append-only    (versioned)   (signed docs)    (deposit,
  promoter/     status log)                                      balance,
  sponsor/                                                       invoices)
  crew/venue)
       ▼              ▼        ▼        ▼              ▼              ▼
 event_logistics event_campaign event_media event_messages event_tasks event_documents
 (travel, hotel, (30/14/7/1-day (photos,    (unified chat  (call        (contracts,
  driver, rider)  auto-schedule) videos)     thread per     sheets,      riders,
                                             event)         checklists)  invoices)
```

Key rules baked into the schema:
- `events.status` is derived from the latest `event_timeline` row, not stored twice.
- All money (`event_payments`, `event_quotes`) references the event, never a party directly.
- `talents` (was `artists`) and `promoters` become **directory** tables — history/revenue/ratings are computed from `event_parties` joins, never stored on the party row.
- No feature-specific status columns on `events` (no `deposit_status`, no `contract_status`, no `travel_status`). Those live in their satellite tables; the timeline is the single source of truth.

## The six engines (shared infrastructure, feature-free)

Each engine is a thin, generic module in `src/lib/engines/` that **any** future feature calls. No engine knows about talent, promoters, or campaigns specifically — they only know about Events and event_ids.

1. **Event Engine** (`event.functions.ts`) — `createEvent`, `getEvent(id)` returns the full graph in one call, `advanceStage(eventId, stage)`, `getDerivedStatus(eventId)`. Every mutation to any satellite writes a `event_timeline` row.

2. **Timeline Engine** (`timeline.functions.ts`) — append-only event log. Records `{event_id, stage, actor, payload, at}`. Powers status, audit trail, and the live Operating Room feed. Uses Supabase Realtime on `event_timeline`.

3. **Communication Engine** (`comms.functions.ts`) — one thread per event (`event_messages`). Channel-agnostic: `channel: 'in_app' | 'whatsapp' | 'email'`. wa.me deep links today; adapter interface so Twilio/Resend swap in later without touching callers.

4. **Notification Engine** (`notifications.functions.ts`) — rule-based reminders: "deposit overdue > 48h → notify admin". Runs from a `pg_cron` job hitting a `/api/public/cron/notifications` route. Reads timeline, writes to a `notifications` table, deduped by rule+event.

5. **Document Engine** (`documents.functions.ts`) — every generated artefact (quote PDF, contract, invoice, call sheet, POP) is a row in `event_documents` with a Storage path. One generator interface, per-type templates. Existing `quote-pdf.ts` gets wrapped, not rewritten.

6. **Map Engine** (`map.functions.ts`) — distance/travel-time between two locations, cached in `event_logistics`. Wraps the current `guessDistanceKm` LUT behind an interface so a real routing API drops in later.

## Admin becomes the Event Workspace

One route replaces the scattered admin pages: `/_authenticated/events/$id`, with tabs backed by the satellites:

`Overview · Timeline · Chat · Payments · Contracts · Travel · Campaign · Media · Documents · Tasks · Analytics`

Existing `admin.bookings`, `admin.pipeline`, `admin.calendar` become **views over the event graph**, not sources of truth. Directory pages (`admin.talents`, `admin.promoters`) become read-only rosters with computed history from event joins.

## What stays and what moves

| Today | Tomorrow |
|---|---|
| `bookings` (40 cols) | `events` (core cols only) + 10 satellite tables |
| `booking_notes` | folded into `event_messages` (channel=in_app, kind=note) |
| `deposits` | folded into `event_payments` (kind=deposit) |
| `artists` | renamed `talents`, history computed from graph |
| `promoters` | stays as directory; reliability computed from graph |
| `packages` | stays; referenced by `event_quotes` line items |
| `pricing_rules` | stays; consumed by quote engine |
| `booking-score.ts` | stays; input now assembled from the graph, not the row |
| `/api/public/bookings/*` | replaced by `/api/public/events/$ref` |

Public booking form still creates one row — but now that row is an **Event** with a first timeline entry `stage=inquiry`. Zero regression to the public flow.

## Migration strategy (safe, single turn)

1. Additive migration: create all satellite tables + GRANTs + RLS.
2. Backfill from `bookings` into `events` + satellites in the same migration (data preserved by ref).
3. Keep `bookings` as a **view** over `events + event_payments + event_parties` so existing server fns keep working during the swap.
4. Rewrite server fns one at a time to read from the graph, delete the view last.

## Out of scope for this foundation turn (deferred, will plug in later)

- Live Operating Room UI (needs the Realtime timeline first — building it is a follow-up)
- Per-event AI ("call promoter" recommendations) — the engine hook is stubbed, prompt/UI later
- Campaign auto-scheduler cron — table + interface only, no scheduling yet
- Talent self-signup, AI portfolio builder, matchmaking, reviews, video analysis — all become event-graph features later
- WhatsApp Twilio automation — adapter interface only, deep links continue working

## Technical notes (for the engineer)

- All satellites: `event_id uuid not null references events(id) on delete cascade`, RLS `USING (is_staff_or_admin())` for admin tables, narrow anon SELECT on `events` + `event_timeline` for the confirmation/pay pages by `ref`.
- Timeline is append-only: `REVOKE UPDATE, DELETE ON event_timeline FROM authenticated`.
- Add Supabase Realtime publication on `event_timeline`, `event_messages`, `event_payments` (needed for Operating Room later; costs nothing to enable now).
- Engines live in `src/lib/engines/*.functions.ts` behind `createServerFn` + `requireSupabaseAuth`.
- `getEvent(id)` returns one JSON blob assembled server-side (single round trip) — this is the primitive every event workspace tab consumes via `useSuspenseQuery`.
- Server fn `advanceStage` is the ONLY writer to `event_timeline` — every satellite mutation calls it, so status is impossible to desync.
- Rename `artists → talents` via `ALTER TABLE`; regenerated types file will cascade.
- No frontend feature work this turn beyond the Event Workspace shell with real tabs wired to the graph (empty-state where a future feature will land).

## Deliverable checklist

- [ ] Migration: `events`, 10 satellite tables, GRANTs, RLS, `bookings` compatibility view, backfill.
- [ ] `src/lib/engines/{event,timeline,comms,notifications,documents,map}.functions.ts` with typed contracts.
- [ ] Rewrite `listBookings`, booking create, deposit upload, quote generate → call engines.
- [ ] `/_authenticated/events/$id` workspace with tabs (Overview + Timeline live; others show engine-driven empty states).
- [ ] Public routes updated to `/api/public/events/$ref`; old routes proxy for one release.
- [ ] Realtime enabled on the three log tables.

Once approved I'll ship the migration first (single call), then the engines + workspace in the following turn.
