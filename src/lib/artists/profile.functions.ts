// Artist credibility profile CRUD.
// All owner-scoped writes; RLS enforces (artist_owner_id → user_id = auth.uid()).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLATFORMS = [
  "spotify","apple_music","youtube","tiktok","instagram",
  "facebook","x","audiomack","deezer",
] as const;
const AWARD_TIERS = ["platinum","gold","nominee","win","recognition"] as const;
const MEDIA_KINDS = ["photo","video","stage_plot","tech_rider","hospitality","press","music"] as const;
const VERIFICATION_KINDS = ["id","phone","email","management","bank","tax"] as const;

async function getOwnerId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("artist_owner_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No artist profile — complete signup first.");
  return data.id;
}

// -------- Read everything ----------
export const getMyArtistProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("artist_owner_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (!profile) return { profile: null, socials: [], awards: [], media: [], verifications: [], stats: null };
    const [socials, awards, media, verifications, stats] = await Promise.all([
      supabase.from("artist_socials").select("*").eq("artist_owner_id", profile.id).order("platform"),
      supabase.from("artist_awards").select("*").eq("artist_owner_id", profile.id).order("year", { ascending: false }),
      supabase.from("artist_media").select("*").eq("artist_owner_id", profile.id).order("sort_order"),
      supabase.from("artist_verifications").select("*").eq("artist_owner_id", profile.id),
      supabase.from("artist_stats").select("*").eq("artist_owner_id", profile.id).maybeSingle(),
    ]);
    return {
      profile,
      socials: socials.data ?? [],
      awards: awards.data ?? [],
      media: media.data ?? [],
      verifications: verifications.data ?? [],
      stats: stats.data ?? null,
    };
  });

// -------- Update core profile fields ----------
export const updateArtistProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    bio: z.string().trim().max(4000).optional(),
    stage_name: z.string().trim().min(2).max(120).optional(),
    genres: z.array(z.string().trim().max(40)).max(10).optional(),
    location_city: z.string().trim().max(120).optional().nullable(),
    location_country: z.string().trim().max(80).optional().nullable(),
    booking_fee_min_cents: z.number().int().min(0).optional().nullable(),
    booking_fee_max_cents: z.number().int().min(0).optional().nullable(),
    currency: z.string().length(3).optional(),
    photo_url: z.string().url().optional().nullable(),
    rider_notes: z.string().max(4000).optional().nullable(),
    availability_status: z.enum(["available","busy","on_tour","booked","tentative"]).optional(),
    regional_strength: z.array(z.string().trim().max(60)).max(20).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("artist_owner_profiles")
      .update({ ...data, profile_completed: true }).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Socials ----------
export const upsertSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    platform: z.enum(PLATFORMS),
    handle: z.string().trim().max(120).optional().nullable(),
    url: z.string().url().max(400).optional().nullable(),
    followers: z.number().int().min(0).max(2_000_000_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ownerId = await getOwnerId(context.supabase, context.userId);
    const { error } = await context.supabase.from("artist_socials").upsert(
      { artist_owner_id: ownerId, ...data },
      { onConflict: "artist_owner_id,platform" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const deleteSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("artist_socials").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Awards ----------
export const upsertAward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(160),
    organisation: z.string().trim().max(160).optional().nullable(),
    year: z.number().int().min(1950).max(2100).optional().nullable(),
    tier: z.enum(AWARD_TIERS).optional().nullable(),
    sort_order: z.number().int().min(0).max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ownerId = await getOwnerId(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("artist_awards")
        .update(rest).eq("id", id).eq("artist_owner_id", ownerId);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("artist_awards")
        .insert({ artist_owner_id: ownerId, ...rest });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteAward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("artist_awards").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Media kit ----------
export const upsertMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    kind: z.enum(MEDIA_KINDS),
    url: z.string().url().max(600),
    caption: z.string().max(200).optional().nullable(),
    sort_order: z.number().int().min(0).max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ownerId = await getOwnerId(context.supabase, context.userId);
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("artist_media")
        .update(rest).eq("id", id).eq("artist_owner_id", ownerId);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("artist_media")
        .insert({ artist_owner_id: ownerId, ...rest });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("artist_media").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Verifications (request only; staff completes) ----------
export const requestVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(VERIFICATION_KINDS),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ownerId = await getOwnerId(context.supabase, context.userId);
    const { error } = await context.supabase.from("artist_verifications").upsert(
      { artist_owner_id: ownerId, kind: data.kind, status: "pending", notes: data.notes ?? null },
      { onConflict: "artist_owner_id,kind" },
    );
    if (error) throw error;
    return { ok: true };
  });
