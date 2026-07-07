# Mission Control — engine-driven roll-up

Redesign the admin landing surface so Edward answers "what's the single most important thing right now?" in under 10 seconds across the whole roster. Consumes the existing `event_health` engine only — zero duplicate logic in the frontend.

## Route

- Replace the redirect at `src/routes/_authenticated/admin.index.tsx` with a real Mission Control page mounted at `/admin`.
- Change admin shell nav: **Mission Control** becomes the first item; Pipeline moves to second.
- Loader primes `queryClient.ensureQueryData(missionControlQueryOptions(filters))`; component subscribes with `useSuspenseQuery`. Realtime channel on `event_health` invalidates the query on any change.

## Data (one server fn, one query)

Add `getMissionControl(filters)` to `src/lib/engines/decision.functions.ts` (server fn, `requireSupabaseAuth`). Returns everything the page renders — no per-card fetches:

```ts
{
  header: { total, avgHealth, green, yellow, red, black, financiallyUnlocked, overdueNBA },
  priorityQueue: [ EventRow, ... ],           // sorted server-side
  financialLock: [ EventRow filtered ],       // lock_active OR default OR pending near date
  actionStack: {
    critical: [ ActionItem ],                 // risk red/black or NBA priority>=90
    today:    [ ActionItem ],                 // NBA priority 60-89 or days_to_event<=3
    thisWeek: [ ActionItem ],                 // NBA priority 30-59 or days_to_event<=7
  },
  roster: [ EventRow, ... ],                  // full list for the map
  filterFacets: { artists, promoters, owners }
}
```

`EventRow` = flat DTO: `event_id, ref, event_name, event_date, city, days_to_event, artist_name, promoter_name, owner, health_score, risk_level, financial_lock, next_best_action, pillar_scores, predicted_failure_pct, stale`.

Sort key for Priority Queue (server-side): `risk_rank DESC → financial_lock_rank DESC → predicted_failure_pct DESC → days_to_event ASC → health_score ASC`.

Filters accepted: `risk[]`, `artistId[]`, `promoterId[]`, `owner[]`, `financialLock[]`, `dateFrom`, `dateTo`.

## UI (one page, five stacked zones)

`src/routes/_authenticated/admin.index.tsx` → `MissionControlPage`. Cinematic dark, gold accents, monospace tabular numerics, no clutter. All motion via existing `motion/react` patterns already used elsewhere.

1. **Global Pulse Header** — sticky under nav.
   - Left: giant health score (roster average, 0–100) with color band + tiny sparkline of last 24h averages.
   - Row of chips: `● 3 Critical  ● 7 Attention  ● 24 Healthy  🔒 5 Unlocked  ⏱ 4 Overdue`.
   - Each chip is a filter toggle — clicking scopes the Priority Queue + Roster Map.
   - Live "Last evaluated Xs ago" + a manual re-evaluate button (calls `evaluateStale`).

2. **Priority Queue** — the answer to "what first".
   - Vertical list, max 10 cards visible + "Show all".
   - Each card: event name · date + `T-Xd` · artist · risk dot + health score · financial lock chip · **NBA label** big and bold · prediction % if >30.
   - Two CTAs per card: `Open Workspace` (navigates `/admin/events/{id}`) and `Fix This` (deep-links to the NBA's `cta_route`).
   - Cards ordered by the server sort above; top card gets an extra "This is the one" gold ring.

3. **Financial Lock Panel** — impossible to miss.
   - Full-width red-tinted panel when any events are `default` / `broken`, amber when `pending` past cut-off.
   - One row per event: name, date, lock reason, amount outstanding if available, `Chase payment` CTA (routes to `/admin/events/{id}?tab=payments`).
   - Collapses to a single "All locks cleared ✓" bar when empty.

4. **Today's Action Stack** — aggregate NBAs across the roster.
   - Three columns: **Critical / Today / This Week**.
   - Each item: NBA label · event name · owner avatar/initials · single-click CTA to the fix route.
   - Owner shown when available (from booking `owner_id` / `assigned_to`; if absent, show `—`).
   - Empty column shows "Nothing here — good."

5. **Roster Health Map** — the whole picture, filterable.
   - Sticky filter bar: risk band, artist, promoter, owner, financial lock, date range.
   - Compact row per live event: name + date + 6 tiny pillar bars (financial/logistics/marketing/legal/comms/artist) + health number + risk dot + NBA label truncated.
   - Row click → workspace. Rows are virtualised only if >100.
   - "Live events" = `event_date >= today - 1d` AND `status != cancelled`.

## Realtime

- Single channel per page mount: `supabase.channel('mission-control').on('postgres_changes', {schema:'public', table:'event_health'}, ...)`.
- On any change: `queryClient.invalidateQueries({ queryKey: ['mission-control'] })`. Debounced 300ms so batched engine writes don't thrash.
- Cleanup on unmount.
- Show a subtle "● live" indicator in the header; goes amber if channel drops.

## Filter state

- URL search params via `validateSearch` (`risk`, `artist`, `promoter`, `owner`, `lock`, `from`, `to`) so filtered views are shareable/bookmarkable.
- Header chips + roster filter bar both read/write the same params.

## Empty / edge states

- No live events → hero-style "No live events. Enjoy the quiet."
- Any event has `stale=true` → tiny amber badge next to its health score; header shows "N stale" count with re-evaluate button.
- Engine has never run for an event → row shows "—" for health, NBA = "Run evaluation" CTA.

## Out of scope (explicit)

- AI COO / natural-language narration.
- WhatsApp send-from-Mission-Control.
- Cross-event trend charts beyond the header sparkline.
- Bulk-action mode (multi-select).
- Mobile-specific redesign — page is responsive but tuned for desktop command-centre use.

## Files

- Edit `src/routes/_authenticated/admin.index.tsx` (replace redirect with real page).
- Edit `src/routes/_authenticated/admin.tsx` (add Mission Control nav item first).
- Extend `src/lib/engines/decision.functions.ts` with `getMissionControl` server fn.
- New `src/components/mission-control/` — `pulse-header.tsx`, `priority-queue.tsx`, `financial-lock-panel.tsx`, `action-stack.tsx`, `roster-map.tsx`, `filters.tsx`.

## Verification

- Hard-refresh `/admin`: page renders with SSR data, no client-side loading flash.
- Change a booking's payment status in another tab: Mission Control updates within ~1s without reload.
- Filter by "Red" in the header: Priority Queue, Financial Lock, Roster Map all narrow instantly; URL reflects the filter.
- Top Priority Queue card's `Fix This` CTA lands on the correct tab of the correct event workspace.