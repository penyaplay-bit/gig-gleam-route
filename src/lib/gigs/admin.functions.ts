// Admin moderation for the marketplace.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_staff_or_admin");
  if (!data) throw new Error("Forbidden");
  return userId;
}

export const listPendingGigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("gigs")
      .select("*, promoter_profiles(company_name, contact_name, verified)")
      .in("status", ["pending_review", "open", "reviewing", "shortlisted", "booked", "rejected"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { gigs: data ?? [] };
  });

export const approveGig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: gig, error } = await context.supabase
      .from("gigs")
      .update({ status: "open", approved_at: new Date().toISOString(), approved_by: context.userId })
      .eq("id", data.id)
      .select("promoter_id, event_name")
      .maybeSingle();
    if (error) throw error;
    // Notify promoter
    if (gig) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin
        .from("promoter_profiles")
        .select("user_id")
        .eq("id", gig.promoter_id)
        .maybeSingle();
      if (prof) {
        await supabaseAdmin.from("notifications").insert({
          rule: "gig_approved",
          target_role: "promoter",
          severity: "success",
          title: `Gig live — ${gig.event_name}`,
          body: "Your gig is now visible to managers.",
          meta: { gig_id: data.id, user_id: prof.user_id },
        });
      }
    }
    return { ok: true };
  });

export const rejectGig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("gigs")
      .update({ status: "rejected", admin_notes: data.reason ?? null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listUnverifiedProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [pRes, mRes] = await Promise.all([
      context.supabase
        .from("promoter_profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("manager_profiles")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    return { promoters: pRes.data ?? [], managers: mRes.data ?? [] };
  });

export const verifyPromoter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), verified: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = { verified: data.verified };
    if (data.verified) {
      patch.verified_at = new Date().toISOString();
      patch.verified_by = context.userId;
    }
    const { error } = await context.supabase.from("promoter_profiles").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const verifyManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), verified: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = { verified: data.verified };
    if (data.verified) {
      patch.verified_at = new Date().toISOString();
      patch.verified_by = context.userId;
    }
    const { error } = await context.supabase.from("manager_profiles").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
