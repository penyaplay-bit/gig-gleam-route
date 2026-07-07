// Timeline Engine — thin wrapper around event_timeline reads.
// Writes go through advanceStage() in event.functions.ts so we keep one writer.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listRecentTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("event_timeline")
      .select("*, bookings!inner(id, ref, event_name, city, event_date)")
      .order("at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return { entries: rows ?? [] };
  });
