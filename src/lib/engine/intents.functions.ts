// Booking intent server functions — writes concierge output to booking_intents.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPPORTUNITY_CATEGORIES = [
  "festival","corporate","government","university","club","lounge","wedding",
  "private","brand","tv","radio","cultural","sports","international",
] as const;

const IntentSchema = z.object({
  roles: z.array(z.string()).default([]),
  categories: z.array(z.enum(OPPORTUNITY_CATEGORIES)).min(1),
  fee_min: z.number().nonnegative().nullable().optional(),
  fee_max: z.number().nonnegative().nullable().optional(),
  min_acceptable: z.number().nonnegative().nullable().optional(),
  fee_currency: z.string().default("ZAR"),
  primary_territory: z.string().min(1),
  additional_territories: z.array(z.string()).default([]),
  travel_ok: z.boolean().default(false),
  filters_json: z.record(z.string(), z.any()).default({}),
  // legacy required column — mirror primary_territory for now.
  geo_scope: z.string().optional(),
});

export type IntentInput = z.infer<typeof IntentSchema>;

export const saveBookingIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IntentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      owner_id: userId,
      roles: data.roles,
      categories: data.categories,
      fee_min: data.fee_min ?? null,
      fee_max: data.fee_max ?? null,
      min_acceptable: data.min_acceptable ?? null,
      fee_currency: data.fee_currency,
      primary_territory: data.primary_territory,
      additional_territories: data.additional_territories,
      travel_ok: data.travel_ok,
      filters_json: data.filters_json,
      geo_scope: data.geo_scope ?? data.primary_territory,
      active: true,
    };
    // Upsert the artist's active intent — one per owner for now.
    const { data: existing } = await supabase
      .from("booking_intents")
      .select("id")
      .eq("owner_id", userId)
      .eq("active", true)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("booking_intents").update(row).eq("id", existing.id);
      if (error) throw error;
      return { id: existing.id, updated: true };
    }
    const { data: inserted, error } = await supabase
      .from("booking_intents")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id, updated: false };
  });

export const getMyBookingIntent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("booking_intents")
      .select("*")
      .eq("owner_id", userId)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { intent: data };
  });
