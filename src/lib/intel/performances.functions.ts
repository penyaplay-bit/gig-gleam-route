// Server functions for artist_performances CRUD, venue/promoter search, and dashboard rollups.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EventType = z.enum([
  "festival","club","corporate","wedding","government","private","university","tv","radio","brand","other",
]);

const BookedThrough = z.enum([
  "penya_play","whatsapp","phone","instagram","facebook","existing_client","manager","referral","other",
]);

const PerformanceStatus = z.enum(["confirmed","tentative","completed","cancelled"]);

const PerformanceSchema = z.object({
  id: z.string().uuid().optional(),
  artist_id: z.string().uuid().nullable().optional(),
  event_name: z.string().min(1).max(200),
  venue_id: z.string().uuid().nullable().optional(),
  venue_name: z.string().max(200).nullable().optional(),
  venue_address: z.string().max(400).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  province: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  crowd_est: z.number().int().nonnegative().nullable().optional(),
  headliner_bool: z.boolean().default(false),
  support_for: z.string().max(200).nullable().optional(),
  event_type: EventType.default("other"),
  fee_private: z.number().int().nonnegative().nullable().optional(),
  fee_currency: z.string().max(8).default("ZAR"),
  promoter_name: z.string().max(200).nullable().optional(),
  promoter_id: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes_private: z.string().max(2000).nullable().optional(),
  proof_urls: z.array(z.string().url()).default([]),
  booked_through: BookedThrough.nullable().optional(),
  status: PerformanceStatus.default("confirmed"),
  venue_type: z.string().max(80).nullable().optional(),
});

export type PerformanceInput = z.infer<typeof PerformanceSchema>;

export const listPerformances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("artist_performances")
      .select("*")
      .eq("owner_id", context.userId)
      .order("event_date", { ascending: false });
    if (error) throw new Error(error.message);
    return { performances: data ?? [] };
  });

export const upsertPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PerformanceSchema.parse(d))
  .handler(async ({ context, data }) => {
    const row = { ...data, owner_id: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("artist_performances")
        .update(row)
        .eq("id", data.id)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("artist_performances")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deletePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("artist_performances")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const term = data.q.trim();
    let q = context.supabase.from("artist_venues").select("id, name, city, country").limit(10);
    if (term) q = q.ilike("name", `%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { venues: rows ?? [] };
  });

export const createVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(200),
      city: z.string().max(120).optional(),
      country: z.string().max(120).optional(),
      address: z.string().max(400).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("artist_venues")
      .insert({ ...data, created_by: context.userId })
      .select("id, name, city, country")
      .single();
    if (error) throw new Error(error.message);
    return { venue: row };
  });

export const searchPromoters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    const term = data.q.trim();
    let q = context.supabase.from("promoters").select("id, name, company, city, country").limit(10);
    if (term) q = q.ilike("name", `%${term}%`);
    const { data: rows, error } = await q;
    if (error) return { promoters: [] };
    return { promoters: rows ?? [] };
  });

// ------------------------------------------------------------------
// Intelligence dashboard
// ------------------------------------------------------------------

export const getIntelDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [perfsRes, signalsRes, promotersRes] = await Promise.all([
      supabase
        .from("artist_performances")
        .select("id, event_name, venue_name, city, country, event_date, event_type, crowd_est, headliner_bool, promoter_name")
        .eq("owner_id", userId)
        .order("event_date", { ascending: false }),
      supabase
        .from("artist_market_signals")
        .select("*")
        .eq("owner_id", userId)
        .order("show_count", { ascending: false }),
      supabase
        .from("artist_promoter_relations")
        .select("*")
        .eq("owner_id", userId)
        .order("booking_count", { ascending: false }),
    ]);

    if (perfsRes.error) throw new Error(perfsRes.error.message);
    const performances = perfsRes.data ?? [];
    const signals = signalsRes.data ?? [];
    const promoters = promotersRes.data ?? [];

    // Derive top venues + event types + seasonality from raw performances
    const venueMap = new Map<string, { name: string; count: number; last: string; avg_crowd: number; crowd_n: number }>();
    const typeMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const seasonality: Record<string, number> = {};
    let largestCrowd = 0;
    let firstDate: string | null = null;
    let lastDate: string | null = null;

    for (const p of performances) {
      const venueKey = p.venue_name ?? "Unknown venue";
      const v = venueMap.get(venueKey) ?? { name: venueKey, count: 0, last: p.event_date, avg_crowd: 0, crowd_n: 0 };
      v.count += 1;
      if (p.event_date > v.last) v.last = p.event_date;
      if (p.crowd_est) { v.avg_crowd += p.crowd_est; v.crowd_n += 1; }
      venueMap.set(venueKey, v);

      typeMap.set(p.event_type, (typeMap.get(p.event_type) ?? 0) + 1);
      if (p.country) countryMap.set(p.country, (countryMap.get(p.country) ?? 0) + 1);

      const mon = p.event_date.slice(5, 7);
      seasonality[mon] = (seasonality[mon] ?? 0) + 1;

      if (p.crowd_est && p.crowd_est > largestCrowd) largestCrowd = p.crowd_est;
      if (!firstDate || p.event_date < firstDate) firstDate = p.event_date;
      if (!lastDate || p.event_date > lastDate) lastDate = p.event_date;
    }

    const topVenues = [...venueMap.values()]
      .map(v => ({
        name: v.name,
        count: v.count,
        last_booked_at: v.last,
        avg_crowd: v.crowd_n ? Math.round(v.avg_crowd / v.crowd_n) : null,
        strength: Math.min(100, v.count * 15),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topEventTypes = [...typeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const topCountries = [...countryMap.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // Detect touring corridors: pairs of performances within 7 days
    const corridors = new Map<string, number>();
    const sorted = [...performances].sort((a, b) => a.event_date.localeCompare(b.event_date));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]; const b = sorted[i + 1];
      if (!a.city || !b.city || a.city === b.city) continue;
      const days = (new Date(b.event_date).getTime() - new Date(a.event_date).getTime()) / 86400000;
      if (days > 0 && days <= 7) {
        const key = `${a.city} → ${b.city}`;
        corridors.set(key, (corridors.get(key) ?? 0) + 1);
      }
    }
    const routes = [...corridors.entries()]
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const yearsActive = firstDate && lastDate
      ? Math.max(1, new Date(lastDate).getFullYear() - new Date(firstDate).getFullYear() + 1)
      : 0;

    return {
      stats: {
        total_shows: performances.length,
        years_active: yearsActive,
        largest_crowd: largestCrowd || null,
        first_show: firstDate,
        last_show: lastDate,
        countries: topCountries.length,
      },
      topCities: signals.map(s => ({
        city: s.city,
        country: s.country,
        count: s.show_count,
        last_show_at: s.last_show_at,
        avg_crowd: s.avg_crowd,
      })),
      topCountries,
      topVenues,
      topPromoters: promoters.map(p => ({
        name: p.promoter_name,
        count: p.booking_count,
        last_booked_at: p.last_booked_at,
        strength: p.strength_score,
      })),
      topEventTypes,
      seasonality,
      routes,
      timeline: performances.slice(0, 40).map(p => ({
        id: p.id,
        event_name: p.event_name,
        venue_name: p.venue_name,
        city: p.city,
        country: p.country,
        event_date: p.event_date,
        event_type: p.event_type,
        crowd_est: p.crowd_est,
        headliner: p.headliner_bool,
      })),
    };
  });
