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
// Mission Control — engine-driven roll-up across the entire roster.
// ---------------------------------------------------------------

export interface MissionControlEventRow {
  event_id: string;
  ref: string;
  event_name: string;
  event_date: string | null;
  city: string | null;
  days_to_event: number | null;
  artist_name: string | null;
  promoter_name: string | null;
  health_score: number;
  risk_level: RiskLevel;
  financial_lock: FinancialLock;
  next_best_action: NextBestAction;
  pillar_scores: Record<PillarKey, number>;
  predicted_failure_pct: number;
  stale: boolean;
  evaluated_at: string;
}

export interface MissionControlAction {
  event_id: string;
  ref: string;
  event_name: string;
  event_date: string | null;
  days_to_event: number | null;
  risk_level: RiskLevel;
  nba: NextBestAction;
}

export interface MissionControlDTO {
  header: {
    total: number;
    avg_health: number;
    green: number;
    yellow: number;
    red: number;
    black: number;
    financially_unlocked: number;
    stale: number;
    last_evaluated_at: string | null;
  };
  priority_queue: MissionControlEventRow[];
  financial_lock: MissionControlEventRow[];
  action_stack: {
    critical: MissionControlAction[];
    today: MissionControlAction[];
    this_week: MissionControlAction[];
  };
  roster: MissionControlEventRow[];
  filter_facets: {
    artists: { id: string; name: string }[];
    promoters: { id: string; name: string }[];
  };
}

const RISK_RANK: Record<RiskLevel, number> = { black: 4, red: 3, yellow: 2, green: 1 };
const LOCK_RANK: Record<FinancialLock, number> = { default: 4, broken: 3, pending: 2, none: 1, cleared: 0 };

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86400_000);
}

export const getMissionControl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        risk: z.array(z.enum(["green", "yellow", "red", "black"])).optional(),
        lock: z.array(z.enum(["none", "pending", "cleared", "broken", "default"])).optional(),
        artistId: z.array(z.string().uuid()).optional(),
        promoterId: z.array(z.string().uuid()).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("event_health")
      .select(
        "*, bookings!inner(id, ref, event_name, event_date, city, status, artist_id, promoter_id, artists(id, name), promoters(id, name))",
      )
      .limit(500);
    if (error) throw error;

    const todayIso = new Date(Date.now() - 86400_000).toISOString();

    type Raw = {
      event_id: string;
      health_score: number;
      risk_level: RiskLevel;
      financial_lock: FinancialLock;
      pillar_scores: Record<PillarKey, number>;
      next_best_action: NextBestAction;
      predicted_failure_pct: number;
      stale: boolean;
      evaluated_at: string;
      bookings: {
        id: string;
        ref: string;
        event_name: string;
        event_date: string | null;
        city: string | null;
        status: string | null;
        artist_id: string | null;
        promoter_id: string | null;
        artists: { id: string; name: string } | null;
        promoters: { id: string; name: string } | null;
      };
    };

    const raw = (rows ?? []) as unknown as Raw[];

    // Live events only: non-cancelled AND (no date OR date within last day forward)
    const live = raw.filter((r) => {
      const b = r.bookings;
      if (!b) return false;
      if (b.status === "cancelled") return false;
      if (b.event_date && b.event_date < todayIso.slice(0, 10)) return false;
      return true;
    });

    const artistsMap = new Map<string, { id: string; name: string }>();
    const promotersMap = new Map<string, { id: string; name: string }>();
    for (const r of live) {
      if (r.bookings.artists) artistsMap.set(r.bookings.artists.id, r.bookings.artists);
      if (r.bookings.promoters) promotersMap.set(r.bookings.promoters.id, r.bookings.promoters);
    }

    const filtered = live.filter((r) => {
      if (data.risk?.length && !data.risk.includes(r.risk_level)) return false;
      if (data.lock?.length && !data.lock.includes(r.financial_lock)) return false;
      if (data.artistId?.length && !(r.bookings.artist_id && data.artistId.includes(r.bookings.artist_id))) return false;
      if (data.promoterId?.length && !(r.bookings.promoter_id && data.promoterId.includes(r.bookings.promoter_id))) return false;
      if (data.dateFrom && r.bookings.event_date && r.bookings.event_date < data.dateFrom) return false;
      if (data.dateTo && r.bookings.event_date && r.bookings.event_date > data.dateTo) return false;
      return true;
    });

    const toRow = (r: Raw): MissionControlEventRow => ({
      event_id: r.event_id,
      ref: r.bookings.ref,
      event_name: r.bookings.event_name,
      event_date: r.bookings.event_date,
      city: r.bookings.city,
      days_to_event: daysBetween(r.bookings.event_date),
      artist_name: r.bookings.artists?.name ?? null,
      promoter_name: r.bookings.promoters?.name ?? null,
      health_score: r.health_score,
      risk_level: r.risk_level,
      financial_lock: r.financial_lock,
      next_best_action: r.next_best_action,
      pillar_scores: r.pillar_scores,
      predicted_failure_pct: r.predicted_failure_pct ?? 0,
      stale: r.stale,
      evaluated_at: r.evaluated_at,
    });

    const roster = filtered.map(toRow);

    // Priority sort: risk desc, lock desc, prediction desc, days asc, health asc
    const priority_queue = [...roster].sort((a, b) => {
      const rr = (RISK_RANK[b.risk_level] ?? 0) - (RISK_RANK[a.risk_level] ?? 0);
      if (rr) return rr;
      const lr = (LOCK_RANK[b.financial_lock] ?? 0) - (LOCK_RANK[a.financial_lock] ?? 0);
      if (lr) return lr;
      const pr = (b.predicted_failure_pct ?? 0) - (a.predicted_failure_pct ?? 0);
      if (pr) return pr;
      const da = a.days_to_event ?? 9999;
      const db = b.days_to_event ?? 9999;
      if (da !== db) return da - db;
      return a.health_score - b.health_score;
    });

    const financial_lock = roster
      .filter((r) => r.financial_lock === "default" || r.financial_lock === "broken" || r.financial_lock === "pending")
      .sort((a, b) => {
        const lr = (LOCK_RANK[b.financial_lock] ?? 0) - (LOCK_RANK[a.financial_lock] ?? 0);
        if (lr) return lr;
        return (a.days_to_event ?? 9999) - (b.days_to_event ?? 9999);
      });

    const urgencyRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const actions: MissionControlAction[] = roster
      .filter((r) => r.next_best_action && r.next_best_action.code !== "on_track")
      .map((r) => ({
        event_id: r.event_id,
        ref: r.ref,
        event_name: r.event_name,
        event_date: r.event_date,
        days_to_event: r.days_to_event,
        risk_level: r.risk_level,
        nba: r.next_best_action,
      }))
      .sort((a, b) => {
        const ur = (urgencyRank[b.nba.urgency] ?? 0) - (urgencyRank[a.nba.urgency] ?? 0);
        if (ur) return ur;
        return (a.days_to_event ?? 9999) - (b.days_to_event ?? 9999);
      });

    const action_stack = {
      critical: actions.filter((a) => a.nba.urgency === "critical" || a.risk_level === "black"),
      today: actions.filter(
        (a) => a.nba.urgency === "high" || (a.days_to_event !== null && a.days_to_event <= 3),
      ).filter((a) => !(a.nba.urgency === "critical" || a.risk_level === "black")),
      this_week: actions.filter(
        (a) =>
          a.nba.urgency === "medium" ||
          (a.days_to_event !== null && a.days_to_event > 3 && a.days_to_event <= 7),
      ).filter((a) => a.nba.urgency !== "critical" && a.nba.urgency !== "high" && a.risk_level !== "black"),
    };

    const header = {
      total: roster.length,
      avg_health: roster.length
        ? Math.round(roster.reduce((s, r) => s + r.health_score, 0) / roster.length)
        : 0,
      green: roster.filter((r) => r.risk_level === "green").length,
      yellow: roster.filter((r) => r.risk_level === "yellow").length,
      red: roster.filter((r) => r.risk_level === "red").length,
      black: roster.filter((r) => r.risk_level === "black").length,
      financially_unlocked: roster.filter(
        (r) => r.financial_lock === "default" || r.financial_lock === "broken" || r.financial_lock === "pending",
      ).length,
      stale: roster.filter((r) => r.stale).length,
      last_evaluated_at: roster.reduce<string | null>(
        (acc, r) => (!acc || r.evaluated_at > acc ? r.evaluated_at : acc),
        null,
      ),
    };

    const dto: MissionControlDTO = {
      header,
      priority_queue,
      financial_lock,
      action_stack,
      roster,
      filter_facets: {
        artists: [...artistsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        promoters: [...promotersMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      },
    };
    return dto;
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
