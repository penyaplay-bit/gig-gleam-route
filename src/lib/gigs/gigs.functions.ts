// Server functions for gigs: create, list, read, promoter status changes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateGigSchema = z.object({
  event_name: z.string().trim().min(2).max(200),
  event_type: z.string().trim().min(2).max(80),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().trim().min(2).max(200),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(80),
  crowd_size: z.number().int().min(10).max(500000),
  budget_low_cents: z.number().int().nonnegative(),
  budget_high_cents: z.number().int().positive(),
  currency: z.string().trim().length(3).default("ZAR"),
  genre_needed: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  artist_type_needed: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  application_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(4000).optional(),
});

export const createGig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateGigSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.budget_high_cents < data.budget_low_cents) {
      throw new Error("Budget high must be greater than or equal to budget low.");
    }
    // Find promoter profile
    const { data: profile } = await supabase
      .from("promoter_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("You need a promoter profile to post a gig.");

    const { data: gig, error } = await supabase
      .from("gigs")
      .insert({
        ...data,
        promoter_id: profile.id,
        description: data.description ?? null,
        status: "pending_review",
      })
      .select("id")
      .single();
    if (error) throw error;

    // Notify admin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      rule: "gig_submitted",
      target_role: "admin",
      severity: "info",
      title: `New gig awaiting review — ${data.event_name}`,
      body: `${data.city}, ${data.country} · ${data.crowd_size.toLocaleString()} crowd`,
      meta: { gig_id: gig.id },
    });

    return { ok: true, gig_id: gig.id };
  });

export const listMyGigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("promoter_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { gigs: [] };
    const { data, error } = await supabase
      .from("gigs")
      .select("*, gig_applications(id, status)")
      .eq("promoter_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { gigs: data ?? [] };
  });

export const getMyGig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [gigRes, appsRes] = await Promise.all([
      supabase.from("gigs").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("gig_applications")
        .select("*, manager_profiles(id, contact_name, agency_name, verified), artist_rosters(artist_name, genre, artist_type)")
        .eq("gig_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (gigRes.error) throw gigRes.error;
    if (!gigRes.data) throw new Error("Gig not found");
    return { gig: gigRes.data, applications: appsRes.data ?? [] };
  });

// Public listing — no auth. Uses server publishable key + narrow RLS.
export const listOpenGigs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        city: z.string().trim().max(120).optional(),
        genre: z.string().trim().max(40).optional(),
        min_budget: z.number().int().nonnegative().optional(),
        verified_only: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const today = new Date().toISOString().slice(0, 10);
    let query = supabase
      .from("gigs")
      .select("*, promoter_profiles(id, company_name, contact_name, verified, trust_score)")
      .in("status", ["open", "reviewing", "shortlisted"])
      .gte("application_deadline", today)
      .order("boost_until", { ascending: false, nullsFirst: false })
      .order("application_deadline", { ascending: true })
      .limit(100);
    if (data.city) query = query.ilike("city", `%${data.city}%`);
    if (data.genre) query = query.contains("genre_needed", [data.genre]);
    if (data.min_budget) query = query.gte("budget_high_cents", data.min_budget);
    const { data: rows, error } = await query;
    if (error) throw error;
    let gigs = rows ?? [];
    if (data.verified_only) {
      gigs = gigs.filter((g: any) => g.promoter_profiles?.verified);
    }
    return { gigs };
  });

export const getPublicGig = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: gig, error } = await supabase
      .from("gigs")
      .select("*, promoter_profiles(id, company_name, contact_name, verified, trust_score, country, city)")
      .eq("id", data.id)
      .in("status", ["open", "reviewing", "shortlisted"])
      .maybeSingle();
    if (error) throw error;
    if (!gig) throw new Error("Gig not found or no longer open.");
    return { gig };
  });
