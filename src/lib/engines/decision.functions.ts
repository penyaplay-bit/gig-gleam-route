// Decision Engine — the Operating Brain.
//
// Single source of truth for event health, risk, financial lock, pillar
// scores, next best action, and predicted failure. Every consumer
// (workspace, Mission Control, AI, WhatsApp, campaigns) reads only —
// they never compute their own status.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------
// Factor registry — the only place weights and labels live.
// ---------------------------------------------------------------

export type PillarKey =
  | "financial"
  | "logistics"
  | "marketing"
  | "legal"
  | "communication"
  | "talent";

export const PILLARS: PillarKey[] = [
  "financial",
  "logistics",
  "marketing",
  "legal",
  "communication",
  "talent",
];

export type FactorCode =
  | "deposit_paid"
  | "balance_paid"
  | "contract_signed"
  | "artist_confirmed"
  | "logistics_ready"
  | "campaign_running"
  | "documents_complete"
  | "weather_risk"
  | "hotel_missing"
  | "driver_missing"
  | "t7_lock_broken"
  | "promoter_silent_72h";

export interface FactorSpec {
  code: FactorCode;
  label: string;
  weight: number; // signed
  category: PillarKey;
  cta_tab?: string; // workspace tab to fix this factor
}

export const FACTORS: readonly FactorSpec[] = [
  { code: "deposit_paid",        label: "Deposit received",             weight:  20, category: "financial",     cta_tab: "payments" },
  { code: "balance_paid",        label: "Final balance received",       weight:  20, category: "financial",     cta_tab: "payments" },
  { code: "contract_signed",     label: "Contract signed",              weight:  10, category: "legal",         cta_tab: "contracts" },
  { code: "artist_confirmed",    label: "Artist confirmed",             weight:  10, category: "talent",        cta_tab: "parties" },
  { code: "logistics_ready",     label: "Logistics ready",              weight:  15, category: "logistics",     cta_tab: "travel" },
  { code: "campaign_running",    label: "Campaign running",             weight:   5, category: "marketing",     cta_tab: "campaign" },
  { code: "documents_complete",  label: "Key documents on file",        weight:   5, category: "legal",         cta_tab: "documents" },
  { code: "weather_risk",        label: "Weather risk",                 weight:  -5, category: "logistics",     cta_tab: "travel" },
  { code: "hotel_missing",       label: "Hotel not assigned",           weight: -10, category: "logistics",     cta_tab: "travel" },
  { code: "driver_missing",      label: "Driver not assigned",          weight: -10, category: "logistics",     cta_tab: "travel" },
  { code: "t7_lock_broken",      label: "7-day financial lock broken",  weight: -30, category: "financial",     cta_tab: "payments" },
  { code: "promoter_silent_72h", label: "Promoter silent 72h+",         weight: -10, category: "communication", cta_tab: "chat" },
] as const;

// Positive-weight totals per pillar → drive baseline so all-positive-active = 100.
const PILLAR_POSITIVE_MAX: Record<PillarKey, number> = PILLARS.reduce(
  (acc, p) => {
    acc[p] = FACTORS.filter((f) => f.category === p && f.weight > 0)
      .reduce((s, f) => s + f.weight, 0);
    return acc;
  },
  { financial: 0, logistics: 0, marketing: 0, legal: 0, communication: 0, talent: 0 },
);

export type RiskLevel = "green" | "yellow" | "red" | "black";
export type FinancialLock = "none" | "pending" | "cleared" | "broken" | "default";

export interface ActiveFactor {
  code: FactorCode;
  label: string;
  delta: number;
  category: PillarKey;
  active: boolean;
  cta_tab?: string;
}

export interface NextBestAction {
  code: string;
  label: string;
  reason: string;
  cta_tab: string;
  cta_label: string;
  urgency: "low" | "medium" | "high" | "critical";
}

export interface EventHealthDTO {
  event_id: string;
  health_score: number;
  risk_level: RiskLevel;
  pulse: RiskLevel;
  financial_lock: FinancialLock;
  pillar_scores: Record<PillarKey, number>;
  factors: ActiveFactor[];
  next_best_action: NextBestAction;
  predicted_failure_pct: number;
  predicted_reasons: string[];
  evaluated_at: string;
  stale: boolean;
}

// ---------------------------------------------------------------
// Read helpers — every consumer uses these.
// ---------------------------------------------------------------

export const getEventHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("event_health")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();
    if (error) throw error;
    return (row ?? null) as unknown as EventHealthDTO | null;
  });

export const getEventHealthHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ eventId: z.string().uuid(), days: z.number().int().min(1).max(90).default(14) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("event_health_history")
      .select("health_score, risk_level, pillar_scores, snapshot_at")
      .eq("event_id", data.eventId)
      .gte("snapshot_at", since)
      .order("snapshot_at", { ascending: true });
    if (error) throw error;
    return { points: rows ?? [] };
  });

export const listEventHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ risk: z.enum(["green","yellow","red","black"]).optional(), limit: z.number().int().min(1).max(500).default(200) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("event_health")
      .select("*, bookings!inner(id, ref, event_name, event_date, city)")
      .order("health_score", { ascending: true })
      .limit(data.limit);
    if (data.risk) q = q.eq("risk_level", data.risk);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { rows: rows ?? [] };
  });

// ---------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------

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
  if (g.status === "confirmed" || g.parties.some((p) => p.role === "talent" && p.artist_id)) {
    active.add("artist_confirmed");
  }

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
  if (anyInbound && lastInbound && Date.now() - lastInbound > 72 * 3600_000) {
    active.add("promoter_silent_72h");
  }
  return active;
}

function scoreFromFactors(active: Set<FactorCode>): number {
  let s = 60; // baseline
  for (const f of FACTORS) if (active.has(f.code)) s += f.weight;
  return Math.max(0, Math.min(100, s));
}

function riskBand(score: number, financial_lock: FinancialLock): RiskLevel {
  if (financial_lock === "default") return "black";
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "red";
  return "black";
}

function pillarScores(active: Set<FactorCode>): Record<PillarKey, number> {
  const out = {} as Record<PillarKey, number>;
  for (const p of PILLARS) {
    const posMax = PILLAR_POSITIVE_MAX[p];
    const base = 100 - posMax; // so all-positive-active reaches 100
    let s = base;
    for (const f of FACTORS) {
      if (f.category === p && active.has(f.code)) s += f.weight;
    }
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

  if (fs === "payment_default") {
    return { code: "payment_default", label: "Escalate: continuation or cancel", reason: "Final balance not received by the 7-day deadline.", cta_tab: "payments", cta_label: "Open Payments", urgency: "critical" };
  }
  if (active.has("t7_lock_broken")) {
    return { code: "t7_lock_broken", label: "Collect final balance immediately", reason: "Event is inside the 7-day financial lock window.", cta_tab: "payments", cta_label: "Chase balance", urgency: "critical" };
  }
  if ((fs === "awaiting_deposit" || fs === null) && dte <= 14) {
    return { code: "deposit_pending", label: "Chase deposit", reason: "Event is close and no deposit has been received.", cta_tab: "payments", cta_label: "Open Payments", urgency: "high" };
  }
  if (!active.has("contract_signed") && active.has("deposit_paid")) {
    return { code: "contract_unsigned", label: "Send contract for signature", reason: "Deposit paid but contract is not yet signed.", cta_tab: "contracts", cta_label: "Open Contracts", urgency: "high" };
  }
  if (active.has("hotel_missing")) {
    return { code: "hotel_missing", label: "Assign hotel", reason: "Event is within 10 days and no hotel is booked.", cta_tab: "travel", cta_label: "Assign hotel", urgency: "high" };
  }
  if (active.has("driver_missing")) {
    return { code: "driver_missing", label: "Assign driver", reason: "Event is within 10 days and no driver is assigned.", cta_tab: "travel", cta_label: "Assign driver", urgency: "high" };
  }
  if (!active.has("campaign_running") && dte <= 21) {
    return { code: "campaign_not_started", label: "Launch campaign", reason: "Event is within 21 days and no campaign is running.", cta_tab: "campaign", cta_label: "Start campaign", urgency: "medium" };
  }
  if (active.has("promoter_silent_72h")) {
    return { code: "promoter_silent_72h", label: "Reach out to promoter", reason: "No promoter reply in the last 72 hours.", cta_tab: "chat", cta_label: "Send message", urgency: "medium" };
  }
  return { code: "on_track", label: "On track — no action needed", reason: "All key factors are green.", cta_tab: "overview", cta_label: "View overview", urgency: "low" };
}

function pickFactors(active: Set<FactorCode>): ActiveFactor[] {
  return FACTORS.map((f) => ({
    code: f.code, label: f.label, delta: f.weight, category: f.category, active: active.has(f.code), cta_tab: f.cta_tab,
  }));
}

function predictFailure(active: Set<FactorCode>): { pct: number; reasons: string[] } {
  const negatives = FACTORS.filter((f) => f.weight < 0 && active.has(f.code));
  const pct = Math.max(0, Math.min(100, Math.round(negatives.reduce((s, f) => s + Math.abs(f.weight) * 2.4, 0))));
  const reasons = negatives.sort((a, b) => a.weight - b.weight).slice(0, 3).map((f) => f.label);
  return { pct, reasons };
}

// ---------------------------------------------------------------
// evaluateEvent — reads graph, upserts event_health, writes history
// and a `decision` timeline row when status changes.
// ---------------------------------------------------------------

export const evaluateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    return await evaluateForClient(supabase, data.eventId);
  });

async function evaluateForClient(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  eventId: string,
): Promise<EventHealthDTO> {
  const [ev, contracts, logistics, campaign, documents, parties, messages, finState, prev] = await Promise.all([
    supabase.from("bookings").select("id, event_date, status").eq("id", eventId).maybeSingle(),
    supabase.from("event_contracts").select("status").eq("event_id", eventId),
    supabase.from("event_logistics").select("hotel, driver").eq("event_id", eventId).maybeSingle(),
    supabase.from("event_campaign").select("status").eq("event_id", eventId),
    supabase.from("event_documents").select("kind").eq("event_id", eventId),
    supabase.from("event_parties").select("role, artist_id").eq("event_id", eventId),
    supabase.from("event_messages").select("created_at, direction").eq("event_id", eventId).order("created_at", { ascending: false }).limit(50),
    supabase.from("event_financial_state" as never).select("*").eq("event_id", eventId).maybeSingle(),
    supabase.from("event_health").select("health_score, risk_level, next_best_action").eq("event_id", eventId).maybeSingle(),
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

  const dto: EventHealthDTO = {
    event_id: eventId,
    health_score,
    risk_level,
    pulse: risk_level,
    financial_lock,
    pillar_scores,
    factors,
    next_best_action: nba,
    predicted_failure_pct: pred.pct,
    predicted_reasons: pred.reasons,
    evaluated_at: new Date().toISOString(),
    stale: false,
  };

  const { error: upErr } = await supabase.from("event_health").upsert({
    event_id: eventId,
    health_score,
    risk_level,
    pulse: risk_level,
    financial_lock,
    pillar_scores,
    factors: factors as unknown as never,
    next_best_action: nba as unknown as never,
    predicted_failure_pct: pred.pct,
    predicted_reasons: pred.reasons as unknown as never,
    evaluated_at: dto.evaluated_at,
    stale: false,
    updated_at: dto.evaluated_at,
  });
  if (upErr) throw upErr;

  const prevRow = prev.data as { health_score?: number; risk_level?: string; next_best_action?: { code?: string } } | null;
  const scoreChanged = !prevRow || prevRow.health_score !== health_score || prevRow.risk_level !== risk_level;
  const nbaChanged = !prevRow || prevRow.next_best_action?.code !== nba.code;

  if (scoreChanged) {
    await supabase.from("event_health_history").insert({
      event_id: eventId,
      health_score,
      risk_level,
      pillar_scores,
    });
  }

  if (scoreChanged || nbaChanged) {
    await supabase.from("event_timeline").insert({
      event_id: eventId,
      stage: "decision",
      payload: {
        health_score,
        risk_level,
        financial_lock,
        next_best_action: nba,
        prev_score: prevRow?.health_score ?? null,
        prev_risk: prevRow?.risk_level ?? null,
      } as unknown as never,
    });
  }

  return dto;
}
