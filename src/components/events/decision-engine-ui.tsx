// Decision Engine consumer components. Pulse header strip, Next Best Action
// card, and full Health tab. Every value comes from event_health / history —
// no local computation.

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, ArrowRight, Heart, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getEventHealth,
  getEventHealthHistory,
  type EventHealthDTO,
  type PillarKey,
  PILLARS,
} from "@/lib/engines/decision.functions";

const RISK_STYLES: Record<string, { dot: string; text: string; label: string; bg: string }> = {
  green:  { dot: "bg-emerald-500",  text: "text-emerald-500",  label: "Healthy",     bg: "bg-emerald-500/10 border-emerald-500/20" },
  yellow: { dot: "bg-amber-500",    text: "text-amber-500",    label: "Attention",   bg: "bg-amber-500/10 border-amber-500/20" },
  red:    { dot: "bg-rose-500",     text: "text-rose-500",     label: "Critical",    bg: "bg-rose-500/10 border-rose-500/20" },
  black:  { dot: "bg-zinc-900",     text: "text-zinc-200",     label: "Locked",      bg: "bg-zinc-900/60 border-zinc-700" },
};

const LOCK_LABELS: Record<string, string> = {
  none: "No lock", pending: "Deposit stage", cleared: "Financially cleared",
  broken: "Inside 7-day lock", default: "Payment default",
};

const PILLAR_LABELS: Record<PillarKey, string> = {
  financial: "Financial", logistics: "Logistics", marketing: "Marketing",
  legal: "Legal", communication: "Communication", talent: "Talent",
};

function useEventHealth(eventId: string) {
  const qc = useQueryClient();
  const fetchHealth = useServerFn(getEventHealth);
  const fetchHistory = useServerFn(getEventHealthHistory);

  const health = useQuery({
    queryKey: ["event-health", eventId],
    queryFn: () => fetchHealth({ data: { eventId } }),
    refetchInterval: 60_000,
  });
  const history = useQuery({
    queryKey: ["event-health-history", eventId],
    queryFn: () => fetchHistory({ data: { eventId, days: 14 } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`event-health-${eventId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_health", filter: `event_id=eq.${eventId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["event-health", eventId] });
          qc.invalidateQueries({ queryKey: ["event-health-history", eventId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, qc]);

  return { health: health.data ?? null, history: history.data?.points ?? [], loading: health.isLoading };
}

// ------- Sparkline -------
function Sparkline({ points }: { points: { health_score: number; snapshot_at: string }[] }) {
  if (points.length < 2) {
    return <div className="text-[10px] text-muted-foreground">Not enough history</div>;
  }
  const w = 120, h = 32;
  const scores = points.map(p => p.health_score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = Math.max(1, max - min);
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.health_score - min) / range) * h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="text-primary">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

// ------- Pulse header (always above tabs) -------
export function PulseHeader({ eventId, onNavigateTab }: { eventId: string; onNavigateTab: (tab: string) => void }) {
  const { health, history, loading } = useEventHealth(eventId);

  if (loading && !health) {
    return <Card className="p-4 bg-card/40 text-xs text-muted-foreground">Evaluating event health…</Card>;
  }
  if (!health) {
    return (
      <Card className="p-4 bg-card/40 text-xs text-muted-foreground flex items-center justify-between">
        <span>No health data yet.</span>
        <span className="text-[10px]">The Decision Engine will populate this within a minute.</span>
      </Card>
    );
  }

  const risk = RISK_STYLES[health.risk_level] ?? RISK_STYLES.yellow;
  const nba = health.next_best_action;

  return (
    <div className="space-y-3">
      <Card className={`p-4 border ${risk.bg}`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-3 h-3 rounded-full ${risk.dot} animate-pulse`} />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Event pulse</div>
              <div className={`text-sm font-medium ${risk.text}`}>{risk.label}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-border/50 pl-4">
            <Heart className={`w-5 h-5 ${risk.text}`} />
            <div>
              <div className="text-2xl font-display leading-none">{health.health_score}<span className="text-xs text-muted-foreground">/100</span></div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Health</div>
            </div>
          </div>

          <div className="hidden md:block border-l border-border/50 pl-4">
            <Sparkline points={history} />
            <div className="text-[10px] text-muted-foreground mt-0.5">14-day trend</div>
          </div>

          <div className="flex-1 min-w-[180px] flex items-center justify-end gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] gap-1">
              <ShieldCheck className="w-3 h-3" /> {LOCK_LABELS[health.financial_lock]}
            </Badge>
            {health.predicted_failure_pct >= 50 && (
              <Badge variant="outline" className="text-[10px] gap-1 border-rose-500/40 text-rose-500">
                <AlertTriangle className="w-3 h-3" /> Failure risk {health.predicted_failure_pct}%
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-primary/5 border-primary/20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-primary/80">Next best action</div>
          <div className="text-sm font-medium mt-0.5">{nba.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{nba.reason}</div>
        </div>
        <Button size="sm" onClick={() => onNavigateTab(nba.cta_tab)} className="gap-1">
          {nba.cta_label} <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </Card>
    </div>
  );
}

// ------- Health tab (pillar breakdown, factors, prediction) -------
export function HealthTab({ eventId, onNavigateTab }: { eventId: string; onNavigateTab: (tab: string) => void }) {
  const { health, history } = useEventHealth(eventId);

  if (!health) {
    return <div className="text-sm text-muted-foreground p-4">Health data pending evaluation.</div>;
  }

  // Trend arrow vs yesterday: nearest history point 24h old
  const now = Date.now();
  const yesterday = history.find(p => now - new Date(p.snapshot_at).getTime() >= 24 * 3600_000);
  const trendFor = (pillar: PillarKey): number | null => {
    if (!yesterday) return null;
    const prev = (yesterday.pillar_scores as Record<string, number>)?.[pillar];
    const curr = health.pillar_scores[pillar];
    if (typeof prev !== "number" || typeof curr !== "number") return null;
    return curr - prev;
  };

  const byCategory: Record<PillarKey, typeof health.factors> = {
    financial: [], logistics: [], marketing: [], legal: [], communication: [], talent: [],
  };
  for (const f of health.factors) byCategory[f.category].push(f);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Pillars */}
      <Card className="p-4 bg-card/40">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium">Pillar breakdown</h3>
        </div>
        <div className="space-y-3">
          {PILLARS.map((p) => {
            const score = health.pillar_scores[p] ?? 0;
            const trend = trendFor(p);
            const barColor = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : score >= 40 ? "bg-rose-500" : "bg-zinc-700";
            return (
              <div key={p}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{PILLAR_LABELS[p]}</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    {score}
                    {trend !== null && trend !== 0 && (
                      trend > 0
                        ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                        : <TrendingDown className="w-3 h-3 text-rose-500" />
                    )}
                  </span>
                </div>
                <div className="h-1.5 mt-1 rounded bg-border/50 overflow-hidden">
                  <div className={barColor} style={{ width: `${score}%`, height: "100%" }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Prediction */}
      <Card className="p-4 bg-card/40">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium">Predicted failure risk</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-display">{health.predicted_failure_pct}%</span>
          <span className="text-xs text-muted-foreground">probability of operational issues</span>
        </div>
        <div className="h-2 mt-3 rounded bg-border/50 overflow-hidden">
          <div className={health.predicted_failure_pct >= 50 ? "bg-rose-500" : "bg-amber-500"}
               style={{ width: `${health.predicted_failure_pct}%`, height: "100%" }} />
        </div>
        {health.predicted_reasons.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {health.predicted_reasons.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-rose-500" /> {r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">No active negative factors.</p>
        )}
      </Card>

      {/* Factors by category */}
      <Card className="p-4 bg-card/40 md:col-span-2">
        <h3 className="text-sm font-medium mb-3">Active factors</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div key={p}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{PILLAR_LABELS[p]}</div>
              <ul className="space-y-1.5">
                {byCategory[p].map((f) => (
                  <li key={f.code} className={`flex items-center justify-between text-xs ${f.active ? "" : "opacity-40"}`}>
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${f.delta > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {f.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`tabular-nums ${f.delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {f.delta > 0 ? "+" : ""}{f.delta}
                      </span>
                      {f.active && f.delta < 0 && f.cta_tab && (
                        <button
                          onClick={() => onNavigateTab(f.cta_tab!)}
                          className="text-primary hover:underline text-[10px]"
                        >
                          Fix
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Small badge form for other surfaces that just want the pulse dot + label.
export function PulseBadge({ health }: { health: EventHealthDTO | null }) {
  if (!health) return null;
  const risk = RISK_STYLES[health.risk_level] ?? RISK_STYLES.yellow;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded border ${risk.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
      <span className={risk.text}>{health.health_score} · {risk.label}</span>
    </span>
  );
}
