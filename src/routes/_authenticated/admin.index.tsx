import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  getMissionControl,
  evaluateEvent,
  PILLARS,
  type MissionControlDTO,
  type MissionControlEventRow,
  type MissionControlAction,
  type RiskLevel,
  type FinancialLock,
  type PillarKey,
} from "@/lib/engines/decision.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Radio,
  RefreshCw,
  Lock,
  ArrowRight,
  ShieldCheck,
  Clock,
  Filter,
  X,
} from "lucide-react";

const searchSchema = z.object({
  risk: fallback(z.string(), "").default(""),
  lock: fallback(z.string(), "").default(""),
  artist: fallback(z.string(), "").default(""),
  promoter: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: zodValidator(searchSchema),
  component: MissionControl,
});

const RISK_STYLES: Record<RiskLevel, { dot: string; ring: string; text: string; bg: string; label: string }> = {
  green:  { dot: "bg-emerald-400",  ring: "ring-emerald-400/30", text: "text-emerald-400",  bg: "bg-emerald-500/10", label: "Healthy" },
  yellow: { dot: "bg-amber-400",    ring: "ring-amber-400/30",   text: "text-amber-300",    bg: "bg-amber-500/10",   label: "Attention" },
  red:    { dot: "bg-rose-500",     ring: "ring-rose-500/40",    text: "text-rose-400",     bg: "bg-rose-500/10",    label: "Critical" },
  black:  { dot: "bg-fuchsia-500",  ring: "ring-fuchsia-500/40", text: "text-fuchsia-300",  bg: "bg-fuchsia-500/10", label: "Broken" },
};

const LOCK_LABEL: Record<FinancialLock, string> = {
  none: "No lock",
  pending: "Pending",
  cleared: "Cleared",
  broken: "Lock broken",
  default: "Default",
};

function parseList(s: string): string[] {
  return s ? s.split(",").filter(Boolean) : [];
}

function MissionControl() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchMc = useServerFn(getMissionControl);
  const evalOne = useServerFn(evaluateEvent);

  const filters = useMemo(
    () => ({
      risk: parseList(search.risk) as RiskLevel[],
      lock: parseList(search.lock) as FinancialLock[],
      artistId: parseList(search.artist),
      promoterId: parseList(search.promoter),
      dateFrom: search.from || undefined,
      dateTo: search.to || undefined,
    }),
    [search],
  );

  const queryKey = useMemo(() => ["mission-control", filters], [filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      fetchMc({
        data: {
          risk: filters.risk.length ? filters.risk : undefined,
          lock: filters.lock.length ? filters.lock : undefined,
          artistId: filters.artistId.length ? filters.artistId : undefined,
          promoterId: filters.promoterId.length ? filters.promoterId : undefined,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        },
      }),
    staleTime: 15_000,
  });

  // Realtime: debounced invalidation on any event_health change.
  const [live, setLive] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("mission-control")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_health" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["mission-control"] });
          }, 300);
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const setFilter = (patch: Partial<typeof search>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) as never, replace: true });
  };

  const toggleInList = (key: "risk" | "lock" | "artist" | "promoter", value: string) => {
    const list = parseList(search[key]);
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    setFilter({ [key]: next.join(",") } as never);
  };

  const clearFilters = () => {
    navigate({
      search: { risk: "", lock: "", artist: "", promoter: "", from: "", to: "" } as never,
      replace: true,
    });
  };

  const anyFilter =
    filters.risk.length ||
    filters.lock.length ||
    filters.artistId.length ||
    filters.promoterId.length ||
    filters.dateFrom ||
    filters.dateTo;

  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const reevaluateStale = async () => {
    const stale = data?.roster.filter((r) => r.stale) ?? [];
    for (const r of stale) {
      setEvaluatingId(r.event_id);
      try {
        await evalOne({ data: { eventId: r.event_id } });
      } catch {
        /* ignore individual failures */
      }
    }
    setEvaluatingId(null);
    queryClient.invalidateQueries({ queryKey: ["mission-control"] });
  };

  if (isLoading || !data) {
    return (
      <div className="py-24 text-center text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Reading the roster…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PulseHeader
        header={data.header}
        live={live}
        isFetching={isFetching}
        onFilterRisk={(risk) => toggleInList("risk", risk)}
        activeRisk={filters.risk}
        onReeval={reevaluateStale}
        evaluatingId={evaluatingId}
      />

      {data.financial_lock.length > 0 && <FinancialLockPanel rows={data.financial_lock} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <PriorityQueue rows={data.priority_queue} />
        </div>
        <div>
          <ActionStack stack={data.action_stack} />
        </div>
      </div>

      <RosterMap
        rows={data.roster}
        facets={data.filter_facets}
        filters={filters}
        anyFilter={!!anyFilter}
        onToggleRisk={(v) => toggleInList("risk", v)}
        onToggleLock={(v) => toggleInList("lock", v)}
        onToggleArtist={(v) => toggleInList("artist", v)}
        onTogglePromoter={(v) => toggleInList("promoter", v)}
        onSetFrom={(v) => setFilter({ from: v })}
        onSetTo={(v) => setFilter({ to: v })}
        onClear={clearFilters}
      />
    </div>
  );
}

/* ---------------------------- Pulse Header ---------------------------- */

function PulseHeader({
  header,
  live,
  isFetching,
  onFilterRisk,
  activeRisk,
  onReeval,
  evaluatingId,
}: {
  header: MissionControlDTO["header"];
  live: boolean;
  isFetching: boolean;
  onFilterRisk: (risk: RiskLevel) => void;
  activeRisk: RiskLevel[];
  onReeval: () => void;
  evaluatingId: string | null;
}) {
  const scoreColor =
    header.avg_health >= 80 ? "text-emerald-400"
    : header.avg_health >= 60 ? "text-amber-300"
    : header.avg_health >= 40 ? "text-rose-400"
    : "text-fuchsia-300";

  const chips: { key: RiskLevel; label: string; count: number; className: string }[] = [
    { key: "black",  label: "Broken",    count: header.black,  className: "border-fuchsia-500/40 text-fuchsia-300" },
    { key: "red",    label: "Critical",  count: header.red,    className: "border-rose-500/40 text-rose-300" },
    { key: "yellow", label: "Attention", count: header.yellow, className: "border-amber-500/40 text-amber-300" },
    { key: "green",  label: "Healthy",   count: header.green,  className: "border-emerald-500/40 text-emerald-300" },
  ];

  const lastEvalSecs = header.last_evaluated_at
    ? Math.max(0, Math.round((Date.now() - new Date(header.last_evaluated_at).getTime()) / 1000))
    : null;

  return (
    <div className="sticky top-[52px] z-20 -mx-4 px-4 py-4 border-b border-primary/10 bg-background/85 backdrop-blur">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-end gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Roster health</div>
            <div className={`text-6xl font-display tabular-nums leading-none ${scoreColor}`}>
              {header.avg_health}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              across {header.total} live event{header.total === 1 ? "" : "s"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            {chips.map((c) => {
              const active = activeRisk.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => onFilterRisk(c.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs flex items-center gap-2 transition ${c.className} ${
                    active ? "bg-foreground/10 ring-1 ring-inset ring-foreground/20" : "bg-transparent hover:bg-foreground/5"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${RISK_STYLES[c.key].dot}`} />
                  <span className="tabular-nums font-mono">{c.count}</span>
                  <span>{c.label}</span>
                </button>
              );
            })}
            <div className="rounded-full border border-primary/40 text-primary/90 px-3 py-1.5 text-xs flex items-center gap-2">
              <Lock className="w-3 h-3" />
              <span className="tabular-nums font-mono">{header.financially_unlocked}</span>
              <span>Unlocked</span>
            </div>
            {header.stale > 0 && (
              <button
                onClick={onReeval}
                disabled={!!evaluatingId}
                className="rounded-full border border-amber-500/40 text-amber-300 px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-amber-500/10 disabled:opacity-60"
              >
                <RefreshCw className={`w-3 h-3 ${evaluatingId ? "animate-spin" : ""}`} />
                <span className="tabular-nums font-mono">{header.stale}</span>
                <span>Stale — re-evaluate</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            {live ? "live" : "reconnecting"}
          </span>
          {lastEvalSecs !== null && (
            <span className="tabular-nums">
              evaluated {lastEvalSecs < 60 ? `${lastEvalSecs}s` : `${Math.round(lastEvalSecs / 60)}m`} ago
            </span>
          )}
          {isFetching && <RefreshCw className="w-3 h-3 animate-spin" />}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Priority Queue --------------------------- */

function PriorityQueue({ rows }: { rows: MissionControlEventRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, 10);

  return (
    <section>
      <SectionHeading title="Priority queue" subtitle="What to touch first, ordered by the engine." />
      {rows.length === 0 ? (
        <EmptyCard message="No live events match this view." />
      ) : (
        <div className="space-y-2">
          {visible.map((row, idx) => (
            <QueueCard key={row.event_id} row={row} highlight={idx === 0 && !showAll} />
          ))}
          {rows.length > 10 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="text-xs text-primary hover:underline mt-2"
            >
              {showAll ? "Show top 10" : `Show all ${rows.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function QueueCard({ row, highlight }: { row: MissionControlEventRow; highlight: boolean }) {
  const style = RISK_STYLES[row.risk_level];
  const nba = row.next_best_action;
  const dte = row.days_to_event;
  return (
    <Card
      className={`p-4 border-border/60 hover:border-primary/40 transition ${
        highlight ? "ring-1 ring-primary/50 border-primary/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-primary">{row.ref}</span>
            <span>·</span>
            <span>{fmtDate(row.event_date)}</span>
            {dte !== null && (
              <span className="font-mono tabular-nums text-foreground/80">
                {dte < 0 ? `T+${Math.abs(dte)}d` : `T-${dte}d`}
              </span>
            )}
            {row.artist_name && (
              <>
                <span>·</span>
                <span className="truncate">{row.artist_name}</span>
              </>
            )}
            {highlight && (
              <Badge className="ml-2 bg-primary/20 text-primary border-primary/40 uppercase tracking-widest text-[9px]">
                This one
              </Badge>
            )}
          </div>
          <div className="mt-1 text-base font-medium truncate">{row.event_name}</div>

          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className={`flex items-center gap-1.5 ${style.text}`}>
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className="font-mono tabular-nums">{row.health_score}</span>
              <span>{style.label}</span>
            </span>
            <LockChip lock={row.financial_lock} />
            {row.predicted_failure_pct > 30 && (
              <span className="text-rose-300/90 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span className="tabular-nums">{row.predicted_failure_pct}%</span>
                <span className="text-muted-foreground">failure risk</span>
              </span>
            )}
            {row.stale && <span className="text-amber-300 text-[10px] uppercase tracking-widest">stale</span>}
          </div>

          <div className="mt-3 rounded-md bg-foreground/[0.03] border border-border/60 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next best action</div>
            <div className="text-sm font-medium mt-0.5">{nba.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{nba.reason}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Link to={"/admin/events/$id" as never} params={{ id: row.event_id } as never}>
            <Button size="sm" variant="outline" className="gap-1">
              Open <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
          <Link to={"/admin/events/$id" as never} params={{ id: row.event_id } as never}>
            <Button size="sm" className="gap-1">
              Fix this
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------ Financial Lock Panel ------------------------ */

function FinancialLockPanel({ rows }: { rows: MissionControlEventRow[] }) {
  const hasCritical = rows.some((r) => r.financial_lock === "default" || r.financial_lock === "broken");
  return (
    <Card
      className={`p-4 border ${
        hasCritical ? "border-rose-500/40 bg-rose-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.05]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lock className={`w-4 h-4 ${hasCritical ? "text-rose-400" : "text-amber-300"}`} />
          <h3 className="font-display text-base tracking-wide">Financial lock — {rows.length} event{rows.length === 1 ? "" : "s"}</h3>
        </div>
        <span className="text-xs text-muted-foreground">Money not locked. Fix before anything else.</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <Link
            key={r.event_id}
            to={"/admin/events/$id" as never}
            params={{ id: r.event_id } as never}
            className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/40 px-3 py-2 hover:border-primary/40 transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs text-primary">{r.ref}</span>
              <span className="text-sm truncate">{r.event_name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{fmtDate(r.event_date)}</span>
              {r.days_to_event !== null && (
                <span className="text-xs font-mono tabular-nums text-foreground/70 shrink-0">
                  {r.days_to_event < 0 ? `T+${Math.abs(r.days_to_event)}d` : `T-${r.days_to_event}d`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <LockChip lock={r.financial_lock} />
              <Button size="sm" variant="outline" className="h-7 gap-1">
                Chase <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------- Action Stack ---------------------------- */

function ActionStack({ stack }: { stack: MissionControlDTO["action_stack"] }) {
  return (
    <section>
      <SectionHeading title="Today's action stack" subtitle="Every Next Best Action, grouped by urgency." />
      <div className="space-y-4">
        <ActionColumn title="Critical" tone="critical" items={stack.critical} />
        <ActionColumn title="Today" tone="today" items={stack.today} />
        <ActionColumn title="This week" tone="week" items={stack.this_week} />
      </div>
    </section>
  );
}

function ActionColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "critical" | "today" | "week";
  items: MissionControlAction[];
}) {
  const toneClass =
    tone === "critical" ? "text-rose-300 border-rose-500/30"
    : tone === "today" ? "text-amber-300 border-amber-500/30"
    : "text-emerald-300 border-emerald-500/30";
  return (
    <Card className="p-3 border-border/60">
      <div className={`flex items-center justify-between border-l-2 pl-2 mb-2 ${toneClass}`}>
        <span className="text-xs uppercase tracking-widest">{title}</span>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground/70 py-3 text-center">Nothing here — good.</div>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 6).map((a) => (
            <Link
              key={a.event_id + a.nba.code}
              to={"/admin/events/$id" as never}
              params={{ id: a.event_id } as never}
              className="block rounded-md border border-border/50 bg-background/40 px-2.5 py-2 hover:border-primary/40 transition"
            >
              <div className="text-sm font-medium truncate">{a.nba.label}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-primary/80">{a.ref}</span>
                <span className="truncate">{a.event_name}</span>
                {a.days_to_event !== null && (
                  <span className="font-mono tabular-nums ml-auto shrink-0">
                    {a.days_to_event < 0 ? `T+${Math.abs(a.days_to_event)}d` : `T-${a.days_to_event}d`}
                  </span>
                )}
              </div>
            </Link>
          ))}
          {items.length > 6 && (
            <div className="text-[11px] text-muted-foreground/70 pt-1">+{items.length - 6} more</div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------- Roster Map ---------------------------- */

function RosterMap({
  rows,
  facets,
  filters,
  anyFilter,
  onToggleRisk,
  onToggleLock,
  onToggleArtist,
  onTogglePromoter,
  onSetFrom,
  onSetTo,
  onClear,
}: {
  rows: MissionControlEventRow[];
  facets: MissionControlDTO["filter_facets"];
  filters: {
    risk: RiskLevel[];
    lock: FinancialLock[];
    artistId: string[];
    promoterId: string[];
    dateFrom?: string;
    dateTo?: string;
  };
  anyFilter: boolean;
  onToggleRisk: (v: RiskLevel) => void;
  onToggleLock: (v: FinancialLock) => void;
  onToggleArtist: (v: string) => void;
  onTogglePromoter: (v: string) => void;
  onSetFrom: (v: string) => void;
  onSetTo: (v: string) => void;
  onClear: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const da = a.days_to_event ?? 9999;
        const db = b.days_to_event ?? 9999;
        return da - db;
      }),
    [rows],
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeading title="Roster health map" subtitle={`${rows.length} live event${rows.length === 1 ? "" : "s"}`} inline />
        <div className="flex items-center gap-2">
          {anyFilter && (
            <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="text-xs flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary/40"
          >
            <Filter className="w-3 h-3" /> Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <Card className="p-3 mb-3 border-border/60 space-y-3">
          <FilterRow label="Risk">
            {(["black", "red", "yellow", "green"] as RiskLevel[]).map((r) => (
              <FilterChip key={r} active={filters.risk.includes(r)} onClick={() => onToggleRisk(r)}>
                <span className={`w-1.5 h-1.5 rounded-full ${RISK_STYLES[r].dot}`} /> {RISK_STYLES[r].label}
              </FilterChip>
            ))}
          </FilterRow>
          <FilterRow label="Lock">
            {(["default", "broken", "pending", "cleared", "none"] as FinancialLock[]).map((l) => (
              <FilterChip key={l} active={filters.lock.includes(l)} onClick={() => onToggleLock(l)}>
                {LOCK_LABEL[l]}
              </FilterChip>
            ))}
          </FilterRow>
          {facets.artists.length > 0 && (
            <FilterRow label="Artist">
              {facets.artists.map((a) => (
                <FilterChip key={a.id} active={filters.artistId.includes(a.id)} onClick={() => onToggleArtist(a.id)}>
                  {a.name}
                </FilterChip>
              ))}
            </FilterRow>
          )}
          {facets.promoters.length > 0 && (
            <FilterRow label="Promoter">
              {facets.promoters.map((p) => (
                <FilterChip key={p.id} active={filters.promoterId.includes(p.id)} onClick={() => onTogglePromoter(p.id)}>
                  {p.name}
                </FilterChip>
              ))}
            </FilterRow>
          )}
          <FilterRow label="Date">
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => onSetFrom(e.target.value)}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => onSetTo(e.target.value)}
              className="bg-background border border-border rounded-md px-2 py-1 text-xs"
            />
          </FilterRow>
        </Card>
      )}

      {sorted.length === 0 ? (
        <EmptyCard message="No live events. Enjoy the quiet." />
      ) : (
        <Card className="border-border/60 divide-y divide-border/50 overflow-hidden">
          {sorted.map((r) => (
            <RosterRow key={r.event_id} row={r} />
          ))}
        </Card>
      )}
    </section>
  );
}

function RosterRow({ row }: { row: MissionControlEventRow }) {
  const style = RISK_STYLES[row.risk_level];
  return (
    <Link
      to={"/admin/events/$id" as never}
      params={{ id: row.event_id } as never}
      className="grid grid-cols-[minmax(0,3fr)_auto_auto_auto_auto] items-center gap-4 px-3 py-2.5 hover:bg-foreground/[0.03] transition"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
          <span className="font-mono text-[11px] text-primary/80 shrink-0">{row.ref}</span>
          <span className="text-sm truncate">{row.event_name}</span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
          {[row.artist_name, row.city, fmtDate(row.event_date)].filter(Boolean).join(" · ")} — {row.next_best_action.label}
        </div>
      </div>
      <PillarBars pillars={row.pillar_scores} />
      <LockChip lock={row.financial_lock} compact />
      <span className={`text-xs font-mono tabular-nums ${style.text} w-8 text-right`}>{row.health_score}</span>
      <span className="text-[11px] text-muted-foreground font-mono tabular-nums w-10 text-right">
        {row.days_to_event === null ? "—" : row.days_to_event < 0 ? `+${Math.abs(row.days_to_event)}` : `-${row.days_to_event}`}d
      </span>
    </Link>
  );
}

/* ------------------------------ Bits ------------------------------ */

function SectionHeading({ title, subtitle, inline }: { title: string; subtitle?: string; inline?: boolean }) {
  return (
    <div className={inline ? "" : "mb-3"}>
      <h2 className="font-display text-lg tracking-wide">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center border-dashed border-border/60">
      <ShieldCheck className="w-6 h-6 mx-auto text-emerald-400 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}

function LockChip({ lock, compact }: { lock: FinancialLock; compact?: boolean }) {
  if (lock === "cleared") {
    return (
      <span className="text-[10px] uppercase tracking-widest text-emerald-300 flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> {!compact && "Cleared"}
      </span>
    );
  }
  if (lock === "none") {
    return <span className="text-[10px] uppercase tracking-widest text-muted-foreground">—</span>;
  }
  const tone =
    lock === "default" ? "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40"
    : lock === "broken" ? "bg-rose-500/15 text-rose-300 border-rose-500/40"
    : "bg-amber-500/10 text-amber-300 border-amber-500/40";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${tone}`}>
      <Lock className="w-2.5 h-2.5" /> {LOCK_LABEL[lock]}
    </span>
  );
}

function PillarBars({ pillars }: { pillars: Record<PillarKey, number> }) {
  return (
    <div className="hidden md:flex items-end gap-0.5 h-5" title={PILLARS.map((p) => `${p}: ${pillars?.[p] ?? 0}`).join(" · ")}>
      {PILLARS.map((p) => {
        const v = pillars?.[p] ?? 0;
        const color =
          v >= 80 ? "bg-emerald-400"
          : v >= 60 ? "bg-amber-400"
          : v >= 40 ? "bg-rose-500"
          : "bg-fuchsia-500";
        return <span key={p} className={`w-1.5 rounded-sm ${color} opacity-80`} style={{ height: `${Math.max(10, v)}%` }} />;
      })}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] rounded-full border px-2.5 py-1 flex items-center gap-1.5 transition ${
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {children}
    </button>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "no date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Suppress unused-import warnings for icons only referenced via chip variants.
void Radio;
void Clock;
