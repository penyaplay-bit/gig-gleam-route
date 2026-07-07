// Event Engine — the primitive every module builds on.
//
// getEvent(id): returns the full event graph in one server round trip.
// advanceStage(): the ONLY writer to event_timeline. Every satellite
// mutation calls it so status can never desync.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Canonical timeline stages. Not an enum on the DB side by design — new
// stages can be added by any engine without a schema change.
export const EVENT_STAGES = [
  "created",
  "quote_generated",
  "quote_viewed",
  "negotiation",
  "contract_sent",
  "contract_signed",
  "deposit_pending",
  "deposit_paid",
  "confirmed",
  "driver_assigned",
  "hotel_booked",
  "campaign_started",
  "travel_started",
  "artist_arrived",
  "performance_started",
  "performance_finished",
  "balance_paid",
  "thank_you_sent",
  "review_completed",
  "archived",
  "cancelled",
  "declined",
] as const;

export type EventStage = (typeof EVENT_STAGES)[number];

export const getEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const eventId = data.id;

    const [
      eventRes,
      timelineRes,
      partiesRes,
      quotesRes,
      contractsRes,
      paymentsRes,
      logisticsRes,
      campaignRes,
      mediaRes,
      messagesRes,
      tasksRes,
      documentsRes,
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select("*, artists(*), promoters(*), packages(*)")
        .eq("id", eventId)
        .maybeSingle(),
      supabase
        .from("event_timeline")
        .select("*")
        .eq("event_id", eventId)
        .order("at", { ascending: false }),
      supabase.from("event_parties").select("*").eq("event_id", eventId),
      supabase
        .from("event_quotes")
        .select("*")
        .eq("event_id", eventId)
        .order("version", { ascending: false }),
      supabase.from("event_contracts").select("*").eq("event_id", eventId),
      supabase
        .from("event_payments")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
      supabase.from("event_logistics").select("*").eq("event_id", eventId).maybeSingle(),
      supabase
        .from("event_campaign")
        .select("*")
        .eq("event_id", eventId)
        .order("scheduled_at", { ascending: true }),
      supabase.from("event_media").select("*").eq("event_id", eventId),
      supabase
        .from("event_messages")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("event_tasks")
        .select("*")
        .eq("event_id", eventId)
        .order("due_at", { ascending: true }),
      supabase.from("event_documents").select("*").eq("event_id", eventId),
    ]);

    if (eventRes.error) throw eventRes.error;
    if (!eventRes.data) throw new Error("Event not found");

    const latest = timelineRes.data?.[0];
    return {
      event: eventRes.data,
      derivedStage: (latest?.stage as EventStage | undefined) ?? "created",
      timeline: timelineRes.data ?? [],
      parties: partiesRes.data ?? [],
      quotes: quotesRes.data ?? [],
      contracts: contractsRes.data ?? [],
      payments: paymentsRes.data ?? [],
      logistics: logisticsRes.data ?? null,
      campaign: campaignRes.data ?? [],
      media: mediaRes.data ?? [],
      messages: messagesRes.data ?? [],
      tasks: tasksRes.data ?? [],
      documents: documentsRes.data ?? [],
    };
  });

export const advanceStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        stage: z.enum(EVENT_STAGES),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_timeline").insert({
      event_id: data.eventId,
      stage: data.stage,
      actor_id: userId,
      payload: (data.payload ?? {}) as never,
    });
    if (error) throw error;
    return { ok: true };
  });

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, ref, event_name, event_date, city, status, artists(name), promoters(name)")
      .order("event_date", { ascending: true });
    if (error) throw error;
    return { events: data ?? [] };
  });
