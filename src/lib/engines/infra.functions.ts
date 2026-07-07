// Notification, Document, and Map engines — typed interfaces + minimal
// implementations. Features plug in against these signatures; internals
// swap (pg_cron, real routing API, PDF generator) without changing callers.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Notifications ----------
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { notifications: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), read_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Documents ----------
export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("event_documents")
      .select("*")
      .eq("event_id", data.eventId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { documents: rows ?? [] };
  });

// ---------- Map ----------
// Static LUT for common Southern-African cities. Replace with a real routing
// API without changing callers.
const CITY_DISTANCES: Record<string, number> = {
  "maseru:johannesburg": 440,
  "maseru:bloemfontein": 160,
  "maseru:durban": 500,
  "maseru:cape town": 1050,
  "maseru:leribe": 100,
  "maseru:teyateyaneng": 40,
  "maseru:mafeteng": 76,
  "maseru:mohale's hoek": 125,
  "maseru:quthing": 175,
};

export function estimateDistanceKm(from: string, to: string): number | null {
  const a = from.trim().toLowerCase();
  const b = to.trim().toLowerCase();
  if (a === b) return 0;
  return CITY_DISTANCES[`${a}:${b}`] ?? CITY_DISTANCES[`${b}:${a}`] ?? null;
}
