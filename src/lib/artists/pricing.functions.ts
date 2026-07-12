// Pricing Strategy for artists — owner-scoped read/write on artist_owner_profiles.
// Advisory only: fees stored here inform quotes, but no AI auto-applies them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cents = z.number().int().min(0).max(1_000_000_000).nullable().optional();
const pct = z.number().int().min(0).max(90).nullable().optional();
const daysArr = z.array(z.number().int().min(0).max(6)).max(7).optional();

const PricingSchema = z.object({
  standard_price_cents: cents,
  dream_price_cents: cents,
  minimum_price_cents: cents,

  growth_price_enabled: z.boolean().optional(),
  growth_price_cents: cents,
  growth_price_pct: pct,

  weekday_price_enabled: z.boolean().optional(),
  weekday_price_cents: cents,
  weekday_price_days: daysArr,

  last_minute_enabled: z.boolean().optional(),
  last_minute_discount_pct: pct,
  last_minute_window_days: z.number().int().min(1).max(30).optional(),

  tour_price_enabled: z.boolean().optional(),
  tour_price_cents: cents,
  tour_radius_km: z.number().int().min(0).max(5000).nullable().optional(),
  tour_max_extra_km: z.number().int().min(0).max(5000).nullable().optional(),

  monthly_income_goal_cents: z.number().int().min(0).max(10_000_000_000).nullable().optional(),
  monthly_goal_currency: z.string().length(3).optional(),

  opportunity_mode_enabled: z.boolean().optional(),

  currency: z.string().length(3).optional(),
});

export type PricingStrategyInput = z.infer<typeof PricingSchema>;

export const getPricingStrategy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("artist_owner_profiles")
      .select(
        "id, currency, booking_fee_min_cents, booking_fee_max_cents, standard_price_cents, dream_price_cents, minimum_price_cents, growth_price_cents, growth_price_pct, growth_price_enabled, weekday_price_cents, weekday_price_days, weekday_price_enabled, last_minute_discount_pct, last_minute_enabled, last_minute_window_days, tour_price_cents, tour_radius_km, tour_max_extra_km, tour_price_enabled, monthly_income_goal_cents, monthly_goal_currency, opportunity_mode_enabled",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { pricing: data ?? null };
  });

export const updatePricingStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PricingSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch = { ...data } as Parameters<
      ReturnType<typeof supabase.from<"artist_owner_profiles">>["update"]
    >[0];
    if (typeof data.standard_price_cents === "number") {
      (patch as { booking_fee_min_cents?: number }).booking_fee_min_cents =
        data.standard_price_cents;
    }
    const { error } = await supabase
      .from("artist_owner_profiles")
      .update(patch)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Simple monthly progress: sum confirmed performance fees this month.
export const getCareerRollup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const nextMonthStart = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
    const in90 = new Date(Date.UTC(y, m, now.getUTCDate() + 90)).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    const [profRes, perfsRes] = await Promise.all([
      supabase
        .from("artist_owner_profiles")
        .select(
          "currency, standard_price_cents, monthly_income_goal_cents, monthly_goal_currency, opportunity_mode_enabled, weekday_price_enabled, growth_price_enabled, last_minute_enabled, tour_price_enabled",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("artist_performances")
        .select(
          "id, event_name, event_date, city, country, fee_private, fee_currency, status, booked_through, promoter_name",
        )
        .eq("owner_id", userId)
        .order("event_date", { ascending: false }),
    ]);

    if (perfsRes.error) throw new Error(perfsRes.error.message);
    const performances = perfsRes.data ?? [];
    const profile = profRes.data ?? null;

    let monthFeesCents = 0;
    let feesCount = 0;
    let confirmedThisMonth = 0;
    let confirmedNext90 = 0;
    const cities = new Set<string>();
    const promoterCounts = new Map<string, number>();
    let feeSum = 0;
    let feeSumN = 0;

    for (const p of performances) {
      if (p.city) cities.add(p.city.trim());
      if (p.promoter_name)
        promoterCounts.set(p.promoter_name, (promoterCounts.get(p.promoter_name) ?? 0) + 1);
      const isConfirmed = (p.status ?? "confirmed") === "confirmed" || p.status === "completed";
      if (isConfirmed) {
        if (p.event_date >= monthStart && p.event_date < nextMonthStart) {
          confirmedThisMonth += 1;
          if (typeof p.fee_private === "number") {
            monthFeesCents += p.fee_private;
          }
        }
        if (p.event_date >= today && p.event_date <= in90) confirmedNext90 += 1;
      }
      if (typeof p.fee_private === "number") {
        feeSum += p.fee_private;
        feeSumN += 1;
        feesCount += 1;
      }
    }

    const repeatPromoters = [...promoterCounts.entries()].filter(([, n]) => n >= 2).length;
    const avgBookingCents = feeSumN > 0 ? Math.round(feeSum / feeSumN) : null;

    return {
      profile,
      counts: {
        confirmedThisMonth,
        confirmedNext90,
        cities: cities.size,
        cityList: [...cities].slice(0, 30),
        repeatPromoters,
        avgBookingCents,
        feesCount,
      },
      monthFeesCents,
      performances,
    };
  });
