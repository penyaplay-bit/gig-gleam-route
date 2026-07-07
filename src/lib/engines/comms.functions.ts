// Communication Engine — one thread per event, channel-agnostic.
// Adapters (Twilio, Resend) plug in later without touching callers.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CHANNELS = ["in_app", "whatsapp", "email", "sms", "other"] as const;
const DIRECTIONS = ["in", "out", "internal"] as const;
const KINDS = ["message", "note", "system"] as const;

export const postMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        body: z.string().min(1).max(4000),
        channel: z.enum(CHANNELS).default("in_app"),
        direction: z.enum(DIRECTIONS).default("internal"),
        kind: z.enum(KINDS).default("note"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("event_messages")
      .insert({
        event_id: data.eventId,
        body: data.body,
        channel: data.channel,
        direction: data.direction,
        kind: data.kind,
        author_id: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { message: row };
  });

/**
 * Compose a wa.me deep link. When Twilio is wired up later, this becomes
 * an adapter that either returns the deep link (current) or sends via API.
 */
export function buildWhatsAppLink(phone: string, body: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}
