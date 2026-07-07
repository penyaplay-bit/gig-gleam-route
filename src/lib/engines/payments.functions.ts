// Payments Engine — 7-Day Financial Lock.
//
// Every action writes a timeline entry via advanceStage(). All financial
// state is derived from the event_financial_state view — never a stored
// column — so the policy cannot desync.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Types (mirror the view + overrides) ----------
export type FinancialState =
  | "awaiting_deposit"
  | "deposit_paid"
  | "balance_pending"
  | "financially_cleared"
  | "payment_default"
  | "cancelled";

export const OVERRIDE_KINDS = [
  "extend_deadline",
  "approve_continuation",
  "cancel",
  "escalate_legal",
] as const;

// ---------- Read: financial state for one event ----------
export const getFinancialState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [stateRes, overridesRes] = await Promise.all([
      supabase
        .from("event_financial_state" as never)
        .select("*")
        .eq("event_id", data.eventId)
        .maybeSingle(),
      supabase
        .from("event_overrides")
        .select("*")
        .eq("event_id", data.eventId)
        .order("created_at", { ascending: false }),
    ]);
    if (stateRes.error) throw stateRes.error;
    return {
      state: stateRes.data as {
        event_id: string;
        ref: string;
        event_date: string;
        total_due_lsl: number;
        paid_lsl: number;
        outstanding_lsl: number;
        balance_due_on: string;
        days_to_event: number;
        days_to_balance_due: number;
        has_continuation: boolean;
        is_cancelled: boolean;
        financial_state: FinancialState;
        lock_active: boolean;
      } | null,
      overrides: overridesRes.data ?? [],
    };
  });

// ---------- Assert not frozen (called by logistics/campaign engines later) ----------
export const assertNotFrozen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("event_financial_state" as never)
      .select("financial_state, has_continuation")
      .eq("event_id", data.eventId)
      .maybeSingle();
    const s = row as { financial_state: FinancialState; has_continuation: boolean } | null;
    if (s?.financial_state === "payment_default" && !s.has_continuation) {
      throw new Error("Event is in Payment Default — Management Override required to proceed.");
    }
    return { ok: true };
  });

// ---------- Record + verify + reject payments ----------
export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        kind: z.enum(["deposit", "balance", "refund", "invoice", "other"]),
        amountLsl: z.number().int().positive(),
        method: z.string().optional(),
        reference: z.string().optional(),
        popPath: z.string().optional(),
        holdFee: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("event_payments")
      .insert({
        event_id: data.eventId,
        kind: data.kind,
        amount_lsl: data.amountLsl,
        method: data.method ?? null,
        reference: data.reference ?? null,
        pop_path: data.popPath ?? null,
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
        hold_status: data.holdFee ? "held" : "released",
      })
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("event_timeline").insert({
      event_id: data.eventId,
      stage: "payment_recorded",
      actor_id: userId,
      payload: { payment_id: row.id, kind: data.kind, amount_lsl: data.amountLsl } as never,
    });
    return { payment: row };
  });

export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pay, error } = await supabase
      .from("event_payments")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: userId,
      })
      .eq("id", data.paymentId)
      .select("*")
      .single();
    if (error) throw error;

    // Advance stage based on new totals
    const { data: state } = await supabase
      .from("event_financial_state" as never)
      .select("financial_state")
      .eq("event_id", pay.event_id)
      .maybeSingle();
    const s = state as { financial_state: FinancialState } | null;
    const nextStage =
      s?.financial_state === "financially_cleared"
        ? "balance_paid"
        : pay.kind === "deposit"
          ? "deposit_paid"
          : "payment_recorded";
    await supabase.from("event_timeline").insert({
      event_id: pay.event_id,
      stage: nextStage,
      actor_id: userId,
      payload: { payment_id: pay.id, kind: pay.kind } as never,
    });
    return { payment: pay };
  });

export const rejectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ paymentId: z.string().uuid(), reason: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pay, error } = await supabase
      .from("event_payments")
      .update({ status: "rejected", meta: { rejection_reason: data.reason } as never })
      .eq("id", data.paymentId)
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("event_timeline").insert({
      event_id: pay.event_id,
      stage: "payment_rejected",
      actor_id: userId,
      payload: { payment_id: pay.id, reason: data.reason } as never,
    });
    return { ok: true };
  });

// ---------- Overrides ----------
export const extendDeadline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        newDeadline: z.string(),
        reason: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Deactivate prior extension
    await supabase
      .from("event_overrides")
      .update({ active: false })
      .eq("event_id", data.eventId)
      .eq("kind", "extend_deadline")
      .eq("active", true);
    const { error } = await supabase.from("event_overrides").insert({
      event_id: data.eventId,
      kind: "extend_deadline",
      new_deadline: data.newDeadline,
      reason: data.reason,
      approved_by: userId,
    });
    if (error) throw error;
    await supabase.from("event_timeline").insert({
      event_id: data.eventId,
      stage: "deadline_extended",
      actor_id: userId,
      payload: { new_deadline: data.newDeadline, reason: data.reason } as never,
    });
    return { ok: true };
  });

export const approveContinuation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ eventId: z.string().uuid(), reason: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_overrides").insert({
      event_id: data.eventId,
      kind: "approve_continuation",
      reason: data.reason,
      approved_by: userId,
    });
    if (error) throw error;
    await supabase.from("event_timeline").insert({
      event_id: data.eventId,
      stage: "override_continuation_approved",
      actor_id: userId,
      payload: { reason: data.reason } as never,
    });
    return { ok: true };
  });

export const cancelForNonPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ eventId: z.string().uuid(), reason: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_overrides").insert({
      event_id: data.eventId,
      kind: "cancel",
      reason: data.reason,
      approved_by: userId,
    });
    if (error) throw error;
    await supabase.from("event_timeline").insert({
      event_id: data.eventId,
      stage: "cancelled_non_payment",
      actor_id: userId,
      payload: { reason: data.reason } as never,
    });
    return { ok: true };
  });

// ---------- Fee holds (artist protection) ----------
export const releaseHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        paymentId: z.string().uuid(),
        reason: z.string().min(1),
        partial: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pay, error } = await supabase
      .from("event_payments")
      .update({
        hold_status: data.partial ? "released_partial" : "released",
        release_reason: data.reason,
        released_at: new Date().toISOString(),
        released_by: userId,
      })
      .eq("id", data.paymentId)
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("event_timeline").insert({
      event_id: pay.event_id,
      stage: "fee_released",
      actor_id: userId,
      payload: { payment_id: pay.id, reason: data.reason, partial: data.partial } as never,
    });
    return { payment: pay };
  });
