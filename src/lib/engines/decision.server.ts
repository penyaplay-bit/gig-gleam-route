// Server-only Decision Engine batch runner (used by cron).
// Uses the service-role client because it iterates across all events
// regardless of the caller identity. Keep this file *.server.ts so it
// never leaks into the client bundle.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EventHealthDTO } from "./decision.functions";
import {
  FACTORS,
  PILLARS,
  type FactorCode,
  type PillarKey,
  type FinancialLock,
  type RiskLevel,
  type NextBestAction,
  type ActiveFactor,
} from "./decision.functions";

// Duplicate the pure helpers here so this module has no cross-import
// on the client-facing functions.ts (which would drag its RPC wrappers
// into server-only code paths).

const PILLAR_POSITIVE_MAX: Record<PillarKey, number> = PILLARS.reduce(
  (acc, p) => {
    acc[p] = FACTORS.filter((f) => f.category === p && f.weight > 0)
      .reduce((s, f) => s + f.weight, 0);
    return acc;
  },
  { financial: 0, logistics: 0, marketing: 0, legal: 0, communication: 0, talent: 0 },
);

interface GraphInputs {
  event_id: string;
  event_date: string | null;
  status: string | null;
  contracts: { status: string | null }[];
  logistics: { hotel: unknown; driver: unknown } | null;
  campaign: { status: string | null }[];
  documents: { kind: string }[];
  parties: { role: string; artist_id: string | null }[];
  messages: { created_at: string; direction: string }[];
  financialState: {
    financial_state: string | null;
    lock_active: boolean | null;
    has_continuation: boolean | null;
    is_cancelled: boolean | null;
    days_to_event: number | null;
  } | null;
}

function computeActiveFactors(g: GraphInputs): Set<FactorCode> {
  const active = new Set<FactorCode>();
  const fs = g.financialState?.financial_state ?? null;
  if (fs && fs !== "awaiting_deposit") active.add("deposit_paid");
  if (fs === "financially_cleared") active.add("balance_paid");
  if (g.contracts.some((c) => c.status === "signed")) active.add("contract_signed");
  if (g.status === "confirmed" || g.parties.some((p) => p.role === "talent" && p.artist_id)) active.add("artist_confirmed");
  const hasHotel = !!g.logistics?.hotel && Object.keys(g.logistics.hotel as object).length > 0;
  const hasDriver = !!g.logistics?.driver && Object.keys(g.logistics.driver as object).length > 0;
  if (hasHotel && hasDriver) active.add("logistics_ready");
  if (g.campaign.some((c) => c.status === "sent" || c.status === "scheduled")) active.add("campaign_running");
  const kinds = new Set(g.documents.map((d) => d.kind));
  if (kinds.has("contract") && (kinds.has("pop") || kinds.has("invoice"))) active.add("documents_complete");
  const dte = g.financialState?.days_to_event ?? 999;
  if (!hasHotel && dte <= 10) active.add("hotel_missing");
  if (!hasDriver && dte <= 10) active.add("driver_missing");
  if (fs === "payment_default") active.add("t7_lock_broken");
  const lastInbound = g.messages
    .filter((m) => m.direction === "in")
    .map((m) => new Date(m.created_at).getTime())
    .sort((a, b) => b - a)[0];
  const anyInbound = g.messages.some((m) => m.direction === "in");
  if (anyInbound && lastInbound && Date.now() - lastInbound > 72 * 3600_000) active.add("promoter_silent_72h");
  return active;
}

function scoreFromFactors(active: Set<FactorCode>): number {
  let s = 60;
  for (const f of FACTORS) if (active.has(f.code)) s += f.weight;
  return Math.max(0, Math.min(100, s));
}

function riskBand(score: number, fl: FinancialLock): RiskLevel {
  if (fl === "default") return "black";
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "red";
  return "black";
}

function pillarScores(active: Set<FactorCode>): Record<PillarKey, number> {
  const out = {} as Record<PillarKey, number>;
  for (const p of PILLARS) {
    const base = 100 - PILLAR_POSITIVE_MAX[p];
    let s = base;
    for (const f of FACTORS) if (f.category === p && active.has(f.code)) s += f.weight;
    out[p] = Math.max(0, Math.min(100, Math.round(s)));
  }
  return out;
}

function pickFinancialLock(g: GraphInputs): FinancialLock {
  const fs = g.financialState?.financial_state;
  if (fs === "payment_default") return "default";
  if (fs === "financially_cleared") return "cleared";
  if (g.financialState?.lock_active) return "broken";
  if (fs === "balance_pending" || fs === "deposit_paid") return "pending";
  return "none";
}

function pickNBA(g: GraphInputs, active: Set<FactorCode>): NextBestAction {
  const fs = g.financialState?.financial_state;
  const dte = g.financialState?.days_to_event ?? 999;
  if (fs === "payment_default") return { code: "payment_default", label: "Escalate: continuation or cancel", reason: "Final balance not received by the 7-day deadline.", cta_tab: "payments", cta_label: "Open Payments", urgency: "critical" };
  if (active.has("t7_lock_broken")) return { code: "t7_lock_broken", label: "Collect final balance immediately", reason: "Event is inside the 7-day financial lock window.", cta_tab: "payments", cta_label: "Chase balance", urgency: "critical" };
  if ((fs === "awaiting_deposit" || fs === null) && dte <= 14) return { code: "deposit_pending", label: "Chase deposit", reason: "Event is close and no deposit has been received.", cta_tab: "payments", cta_label: "Open Payments", urgency: "high" };
  if (!active.has("contract_signed") && active.has("deposit_paid")) return { code: "contract_unsigned", label: "Send contract for signature", reason: "Deposit paid but contract is not yet signed.", cta_tab: "contracts", cta_label: "Open Contracts", urgency: "high" };
  if (active.has("hotel_missing")) return { code: "hotel_missing", label: "Assign hotel", reason: "Event is within 10 days and no hotel is booked.", cta_tab: "travel", cta_label: "Assign hotel", urgency: "high" };
  if (active.has("driver_missing")) return { code: "driver_missing", label: "Assign driver", reason: "Event is within 10 days and no driver is assigned.", cta_tab: "travel", cta_label: "Assign driver", urgency: "high" };
  if (!active.has("campaign_running") && dte <= 21) return { code: "campaign_not_started", label: "Launch campaign", reason: "Event is within 21 days and no campaign is running.", cta_tab: "campaign", cta_label: "Start campaign", urgency: "medium" };
  if (active.has("promoter_silent_72h")) return { code: "promoter_silent_72h", label: "Reach out to promoter", reason: "No promoter reply in the last 72 hours.", cta_tab: "chat", cta_label: "Send message", urgency: "medium" };
  return { code: "on_track", label: "On track — no action needed", reason: "All key factors are green.", cta_tab: "overview", cta_label: "View overview", urgency: "low" };
}

function pickFactors(active: Set<FactorCode>): ActiveFactor[] {
  return FACTORS.map((f) => ({ code: f.code, label: f.label, delta: f.weight, category: f.category, active: active.has(f.code), cta_tab: f.cta_tab }));
}

function predictFailure(active: Set<FactorCode>): { pct: number; reasons: string[] } {
  const negatives = FACTORS.filter((f) => f.weight < 0 && active.has(f.code));
  const pct = Math.max(0, Math.min(100, Math.round(negatives.reduce((s, f) => s + Math.abs(f.weight) * 2.4, 0))));
  const reasons = negatives.sort((a, b) => a.weight - b.weight).slice(0, 3).map((f) => f.label);
  return { pct, reasons };
}

export async function evaluateOne(eventId: string): Promise<EventHealthDTO> {
  const [ev, contracts, logistics, campaign, documents, parties, messages, finState, prev] = await Promise.all([
    supabaseAdmin.from("bookings").select("id, event_date, status").eq("id", eventId).maybeSingle(),
    supabaseAdmin.from("event_contracts").select("status").eq("event_id", eventId),
    supabaseAdmin.from("event_logistics").select("hotel, driver").eq("event_id", eventId).maybeSingle(),
    supabaseAdmin.from("event_campaign").select("status").eq("event_id", eventId),
    supabaseAdmin.from("event_documents").select("kind").eq("event_id", eventId),
    supabaseAdmin.from("event_parties").select("role, artist_id").eq("event_id", eventId),
    supabaseAdmin.from("event_messages").select("created_at, direction").eq("event_id", eventId).order("created_at", { ascending: false }).limit(50),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabaseAdmin.from as any)("event_financial_state").select("*").eq("event_id", eventId).maybeSingle(),
    supabaseAdmin.from("event_health").select("health_score, risk_level, next_best_action").eq("event_id", eventId).maybeSingle(),
  ]);

  const graph: GraphInputs = {
    event_id: eventId,
    event_date: (ev.data as { event_date?: string } | null)?.event_date ?? null,
    status: (ev.data as { status?: string } | null)?.status ?? null,
    contracts: (contracts.data ?? []) as { status: string | null }[],
    logistics: (logistics.data ?? null) as { hotel: unknown; driver: unknown } | null,
    campaign: (campaign.data ?? []) as { status: string | null }[],
    documents: (documents.data ?? []) as { kind: string }[],
    parties: (parties.data ?? []) as { role: string; artist_id: string | null }[],
    messages: (messages.data ?? []) as { created_at: string; direction: string }[],
    financialState: (finState.data ?? null) as GraphInputs["financialState"],
  };

  const active = computeActiveFactors(graph);
  const health_score = scoreFromFactors(active);
  const financial_lock = pickFinancialLock(graph);
  const risk_level = riskBand(health_score, financial_lock);
  const pillar_scores = pillarScores(active);
  const factors = pickFactors(active);
  const nba = pickNBA(graph, active);
  const pred = predictFailure(active);
  const evaluated_at = new Date().toISOString();

  const dto: EventHealthDTO = {
    event_id: eventId, health_score, risk_level, pulse: risk_level, financial_lock,
    pillar_scores, factors, next_best_action: nba,
    predicted_failure_pct: pred.pct, predicted_reasons: pred.reasons,
    evaluated_at, stale: false,
  };

  await supabaseAdmin.from("event_health").upsert({
    event_id: eventId,
    health_score, risk_level, pulse: risk_level, financial_lock,
    pillar_scores,
    factors: factors as unknown as never,
    next_best_action: nba as unknown as never,
    predicted_failure_pct: pred.pct,
    predicted_reasons: pred.reasons as unknown as never,
    evaluated_at, stale: false, updated_at: evaluated_at,
  });

  const prevRow = prev.data as { health_score?: number; risk_level?: string; next_best_action?: { code?: string } } | null;
  const scoreChanged = !prevRow || prevRow.health_score !== health_score || prevRow.risk_level !== risk_level;
  const nbaChanged = !prevRow || prevRow.next_best_action?.code !== nba.code;

  if (scoreChanged) {
    await supabaseAdmin.from("event_health_history").insert({
      event_id: eventId, health_score, risk_level, pillar_scores,
    });
  }
  if (scoreChanged || nbaChanged) {
    await supabaseAdmin.from("event_timeline").insert({
      event_id: eventId,
      stage: "decision",
      payload: {
        health_score, risk_level, financial_lock,
        next_best_action: nba,
        prev_score: prevRow?.health_score ?? null,
        prev_risk: prevRow?.risk_level ?? null,
      } as unknown as never,
    });
  }

  return dto;
}

export async function evaluateStale(limit = 200): Promise<{ evaluated: number }> {
  const { data, error } = await supabaseAdmin
    .from("event_health")
    .select("event_id")
    .eq("stale", true)
    .limit(limit);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.event_id as string);
  for (const id of ids) {
    try { await evaluateOne(id); } catch (e) { console.error("evaluateOne failed", id, e); }
  }
  return { evaluated: ids.length };
}

export async function evaluateAll(): Promise<{ evaluated: number }> {
  const { data, error } = await supabaseAdmin.from("bookings").select("id");
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id as string);
  for (const id of ids) {
    try { await evaluateOne(id); } catch (e) { console.error("evaluateOne failed", id, e); }
  }
  return { evaluated: ids.length };
}
