// Server functions for admin booking operations. All require sign-in + admin/staff role.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOOKING_STATUSES = [
  "new", "reviewing", "quote_sent", "offer_submitted", "counter_offer",
  "deposit_pending", "confirmed", "completed", "cancelled", "declined",
] as const;

export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select("*, artists(name, slug), promoters(name, company), packages(name)")
      .order("event_date", { ascending: true });
    if (error) throw error;
    return { bookings: data ?? [] };
  });

export const getBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [bRes, nRes, dRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("*, artists(*), promoters(*), packages(*)")
        .eq("id", data.id)
        .maybeSingle(),
      supabase
        .from("booking_notes")
        .select("*")
        .eq("booking_id", data.id)
        .order("created_at", { ascending: false }),
      supabase.from("deposits").select("*").eq("booking_id", data.id).order("created_at", { ascending: false }),
    ]);
    if (bRes.error) throw bRes.error;
    if (!bRes.data) throw new Error("Booking not found");
    return { booking: bRes.data, notes: nRes.data ?? [], deposits: dRes.data ?? [] };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(BOOKING_STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Guardrail: cannot go to "confirmed" without a verified deposit
    if (data.status === "confirmed") {
      const { data: dep } = await supabase
        .from("deposits")
        .select("id")
        .eq("booking_id", data.id)
        .eq("status", "verified")
        .limit(1);
      if (!dep || dep.length === 0) {
        throw new Error("Cannot confirm without a verified deposit. Verify a POP first.");
      }
    }
    const { error } = await supabase.from("bookings").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const saveQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        quoted_amount: z.number().int().positive(),
        deposit_pct: z.number().int().min(10).max(100).default(50),
        quote_breakdown: z.record(z.string(), z.unknown()).optional(),
        markAsSent: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const deposit_amount = Math.round((data.quoted_amount * data.deposit_pct) / 100);
    const balance_amount = data.quoted_amount - deposit_amount;
    const patch = {
      quoted_amount: data.quoted_amount,
      deposit_pct: data.deposit_pct,
      deposit_amount,
      balance_amount,
      quote_breakdown: (data.quote_breakdown ?? null) as never,
      ...(data.markAsSent ? { status: "quote_sent" as const } : {}),
    };
    const { error } = await supabase.from("bookings").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ booking_id: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("booking_notes")
      .insert({ booking_id: data.booking_id, body: data.body, author_id: userId, internal: true });
    if (error) throw error;
    return { ok: true };
  });

export const verifyDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ deposit_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dep, error: e1 } = await supabase
      .from("deposits")
      .update({ status: "verified", verified_at: new Date().toISOString(), verified_by: userId })
      .eq("id", data.deposit_id)
      .select("booking_id")
      .maybeSingle();
    if (e1) throw e1;
    if (!dep) throw new Error("Deposit not found");
    // Bump booking to confirmed and record verified timestamp
    const { error: e2 } = await supabase
      .from("bookings")
      .update({ status: "confirmed", deposit_verified_at: new Date().toISOString() })
      .eq("id", dep.booking_id);
    if (e2) throw e2;
    return { ok: true };
  });

export const rejectDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ deposit_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("deposits")
      .update({ status: "rejected" })
      .eq("id", data.deposit_id);
    if (error) throw error;
    return { ok: true };
  });

export const getDepositPreviewUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from("deposits")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export const listPromoters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("promoters")
      .select("*")
      .order("total_revenue", { ascending: false });
    if (error) throw error;
    return { promoters: data ?? [] };
  });

export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("packages")
      .select("*, artists(name, slug)")
      .order("sort_order");
    if (error) throw error;
    return { packages: data ?? [] };
  });

export const upsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        artist_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional().nullable(),
        base_price: z.number().int().nonnegative(),
        crew_size: z.number().int().min(1).max(50),
        duration_minutes: z.number().int().min(0).max(600).optional().nullable(),
        active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const row = { ...data };
    const { error } = await supabase.from("packages").upsert(row);
    if (error) throw error;
    return { ok: true };
  });
