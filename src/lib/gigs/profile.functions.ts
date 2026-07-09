// Marketplace profile bootstrap + read.
// Handles first-time signup role assignment for promoter/manager/artist.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["promoter", "manager", "artist"]);

export const bootstrapProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        role: RoleSchema,
        contact_name: z.string().trim().min(2).max(120),
        whatsapp_number: z.string().trim().min(6).max(40),
        phone: z.string().trim().max(40).optional(),
        company_or_agency: z.string().trim().max(200).optional(),
        country: z.string().trim().max(80).optional(),
        city: z.string().trim().max(120).optional(),
        // artist-only
        stage_name: z.string().trim().max(120).optional(),
        genres: z.array(z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleErr) throw roleErr;

    if (data.role === "promoter") {
      const { error } = await supabaseAdmin
        .from("promoter_profiles")
        .upsert(
          {
            user_id: userId,
            contact_name: data.contact_name,
            phone: data.phone ?? data.whatsapp_number,
            whatsapp_number: data.whatsapp_number,
            company_name: data.company_or_agency ?? null,
            country: data.country ?? null,
            city: data.city ?? null,
            profile_completed: true,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    } else if (data.role === "manager") {
      const { error } = await supabaseAdmin
        .from("manager_profiles")
        .upsert(
          {
            user_id: userId,
            contact_name: data.contact_name,
            phone: data.phone ?? data.whatsapp_number,
            whatsapp_number: data.whatsapp_number,
            agency_name: data.company_or_agency ?? null,
            country: data.country ?? null,
            city: data.city ?? null,
            profile_completed: true,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    } else if (data.role === "artist") {
      const { error } = await supabaseAdmin
        .from("artist_owner_profiles")
        .upsert(
          {
            user_id: userId,
            stage_name: data.stage_name?.trim() || data.contact_name,
            genres: data.genres ?? [],
            whatsapp_number: data.whatsapp_number,
            contact_email: email,
            location_city: data.city ?? null,
            location_country: data.country ?? null,
            profile_completed: false, // artists still need to add fees/media/rider
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    }

    return { ok: true, role: data.role };
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [rolesRes, promRes, mgrRes, artistRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("promoter_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("manager_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("artist_owner_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      roles: (rolesRes.data ?? []).map((r) => r.role),
      promoter: promRes.data ?? null,
      manager: mgrRes.data ?? null,
      artist: artistRes.data ?? null,
    };
  });
