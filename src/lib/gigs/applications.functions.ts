// Gig application server fns for managers and promoters.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ApplySchema = z.object({
  gig_id: z.string().uuid(),
  roster_artist_id: z.string().uuid().optional(),
  quote_cents: z.number().int().positive(),
  currency: z.string().trim().length(3).default("ZAR"),
  availability_notes: z.string().trim().max(1000).optional(),
  rider_notes: z.string().trim().max(2000).optional(),
  message: z.string().trim().max(2000).optional(),
});

export const applyToGig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApplySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("manager_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("You need a manager profile to apply to gigs.");

    const { data: gig } = await supabase
      .from("gigs")
      .select("id, status, event_name, promoter_id")
      .eq("id", data.gig_id)
      .maybeSingle();
    if (!gig || !["open", "reviewing", "shortlisted"].includes(gig.status)) {
      throw new Error("Gig is no longer accepting applications.");
    }

    const { data: app, error } = await supabase
      .from("gig_applications")
      .insert({
        gig_id: data.gig_id,
        manager_id: profile.id,
        roster_artist_id: data.roster_artist_id ?? null,
        quote_cents: data.quote_cents,
        currency: data.currency,
        availability_notes: data.availability_notes ?? null,
        rider_notes: data.rider_notes ?? null,
        message: data.message ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    // Bump gig to 'reviewing' if it was 'open'
    if (gig.status === "open") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("gigs").update({ status: "reviewing" }).eq("id", gig.id);
      // Notify promoter
      await supabaseAdmin.from("notifications").insert({
        rule: "gig_application_received",
        target_role: "promoter",
        severity: "info",
        title: `New application — ${gig.event_name}`,
        body: `A manager applied to your gig.`,
        meta: { gig_id: gig.id, application_id: app.id },
      });
    }
    return { ok: true, application_id: app.id };
  });

export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("manager_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { applications: [] };
    const { data, error } = await supabase
      .from("gig_applications")
      .select("*, gigs(id, event_name, event_date, city, country, status, application_deadline), artist_rosters(artist_name)")
      .eq("manager_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { applications: data ?? [] };
  });

export const withdrawApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("gig_applications")
      .update({ status: "withdrawn" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const shortlistApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: app, error } = await supabase
      .from("gig_applications")
      .update({ status: "shortlisted", shortlisted_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("gig_id, manager_id")
      .maybeSingle();
    if (error) throw error;
    if (app) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("gigs").update({ status: "shortlisted" }).eq("id", app.gig_id);
      await supabaseAdmin.from("notifications").insert({
        rule: "gig_application_shortlisted",
        target_role: "manager",
        severity: "success",
        title: "You've been shortlisted!",
        body: "The promoter shortlisted your application.",
        meta: { application_id: data.id, gig_id: app.gig_id },
      });
    }
    return { ok: true };
  });

export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("gig_applications")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (error) throw error;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      rule: "gig_application_rejected",
      target_role: "manager",
      severity: "warning",
      title: "Application not selected",
      body: "The promoter chose another applicant for this gig.",
      meta: { application_id: data.id },
    });
    return { ok: true };
  });

export const bookApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: app, error } = await supabase
      .from("gig_applications")
      .update({ status: "booked", booked_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("id, gig_id, manager_id")
      .maybeSingle();
    if (error) throw error;
    if (!app) throw new Error("Application not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Mark gig booked, store winning application
    await supabaseAdmin
      .from("gigs")
      .update({ status: "booked", booked_application_id: app.id })
      .eq("id", app.gig_id);
    // Reject all other applications
    await supabaseAdmin
      .from("gig_applications")
      .update({ status: "rejected" })
      .eq("gig_id", app.gig_id)
      .neq("id", app.id)
      .in("status", ["submitted", "shortlisted"]);
    // Bump promoter trust score
    const { data: gig } = await supabaseAdmin
      .from("gigs")
      .select("promoter_id")
      .eq("id", app.gig_id)
      .maybeSingle();
    if (gig) {
      const { data: prof } = await supabaseAdmin
        .from("promoter_profiles")
        .select("confirmed_bookings, verified")
        .eq("id", gig.promoter_id)
        .maybeSingle();
      if (prof) {
        const nextConfirmed = (prof.confirmed_bookings ?? 0) + 1;
        const trust = (prof.verified ? 60 : 0) + Math.min(40, nextConfirmed * 5);
        await supabaseAdmin
          .from("promoter_profiles")
          .update({ confirmed_bookings: nextConfirmed, trust_score: trust })
          .eq("id", gig.promoter_id);
      }
    }
    await supabaseAdmin.from("notifications").insert({
      rule: "gig_application_booked",
      target_role: "manager",
      severity: "success",
      title: "You're booked!",
      body: "Congratulations — the promoter confirmed your application.",
      meta: { application_id: data.id, gig_id: app.gig_id },
    });
    return { ok: true };
  });
