// Manager roster CRUD.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("manager_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return { roster: [] };
    const { data, error } = await supabase
      .from("artist_rosters")
      .select("*")
      .eq("manager_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { roster: data ?? [] };
  });

export const upsertRosterArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        artist_name: z.string().trim().min(1).max(120),
        genre: z.string().trim().max(60).optional(),
        artist_type: z.string().trim().max(60).optional(),
        base_city: z.string().trim().max(120).optional(),
        base_country: z.string().trim().max(80).optional(),
        bio: z.string().trim().max(2000).optional(),
        rate_hint_cents: z.number().int().nonnegative().optional(),
        currency: z.string().trim().length(3).default("ZAR"),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("manager_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Create a manager profile first.");
    const row = {
      ...data,
      manager_id: profile.id,
      genre: data.genre ?? null,
      artist_type: data.artist_type ?? null,
      base_city: data.base_city ?? null,
      base_country: data.base_country ?? null,
      bio: data.bio ?? null,
      rate_hint_cents: data.rate_hint_cents ?? null,
    };
    const { error } = await supabase.from("artist_rosters").upsert(row);
    if (error) throw error;
    return { ok: true };
  });

export const deleteRosterArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("artist_rosters").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
