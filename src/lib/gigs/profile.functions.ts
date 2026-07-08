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
        phone: z.string().trim().max(40).optional(),
        company_or_agency: z.string().trim().max(200).optional(),
        country: z.string().trim().max(80).optional(),
        city: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Assign role (idempotent — unique constraint on user_id+role)
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
            phone: data.phone ?? null,
            company_name: data.company_or_agency ?? null,
            country: data.country ?? null,
            city: data.city ?? null,
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
            phone: data.phone ?? null,
            agency_name: data.company_or_agency ?? null,
            country: data.country ?? null,
            city: data.city ?? null,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    }
    // artist role: profile handled later (out of scope for v1)

    return { ok: true, role: data.role };
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [rolesRes, promRes, mgrRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("promoter_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("manager_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      roles: (rolesRes.data ?? []).map((r) => r.role),
      promoter: promRes.data ?? null,
      manager: mgrRes.data ?? null,
    };
  });
