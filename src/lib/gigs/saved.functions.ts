// Server functions for saved (bookmarked) gigs — manager side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireManagerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("manager_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Manager profile required.");
  return data.id as string;
}

export const listSavedGigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mgr } = await supabase
      .from("manager_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mgr) return { savedIds: [] as string[], gigs: [] as any[] };
    const { data, error } = await supabase
      .from("saved_gigs")
      .select("gig_id, gigs(*, promoter_profiles(id, company_name, contact_name, verified, trust_score))")
      .eq("manager_id", mgr.id)
      .order("saved_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    return {
      savedIds: rows.map((r: any) => r.gig_id as string),
      gigs: rows.map((r: any) => r.gigs).filter(Boolean),
    };
  });

export const toggleSaveGig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ gig_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const managerId = await requireManagerId(supabase, userId);
    const { data: existing } = await supabase
      .from("saved_gigs")
      .select("id")
      .eq("manager_id", managerId)
      .eq("gig_id", data.gig_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("saved_gigs").delete().eq("id", existing.id);
      if (error) throw error;
      return { saved: false };
    }
    const { error } = await supabase
      .from("saved_gigs")
      .insert({ manager_id: managerId, gig_id: data.gig_id });
    if (error) throw error;
    return { saved: true };
  });
