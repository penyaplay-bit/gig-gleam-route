// Payment reminder runner — called hourly + daily by pg_cron.
// Uses the anon apikey header pattern; /api/public/* bypasses auth at the edge.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { REMINDER_META, renderTemplate, type ReminderRule } from "@/lib/engines/payment-templates";

type StateRow = {
  event_id: string;
  ref: string;
  event_date: string;
  outstanding_lsl: number;
  balance_due_on: string;
  days_to_event: number;
  days_to_balance_due: number;
  financial_state: string;
  has_continuation: boolean;
  is_cancelled: boolean;
};

type BookingRow = {
  id: string;
  event_name: string;
  city: string;
};

export const Route = createFileRoute("/api/public/cron/payment-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Pull all upcoming events + their financial state
        const { data: states, error } = await supabaseAdmin
          .from("event_financial_state" as never)
          .select("*")
          .gte("event_date", new Date().toISOString().slice(0, 10));
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const rows = (states ?? []) as StateRow[];
        if (rows.length === 0) {
          return Response.json({ ok: true, processed: 0 });
        }

        const eventIds = rows.map((r) => r.event_id);
        const { data: bookings } = await supabaseAdmin
          .from("bookings")
          .select("id, event_name, city")
          .in("id", eventIds);
        const byId = new Map<string, BookingRow>(
          ((bookings ?? []) as BookingRow[]).map((b) => [b.id, b]),
        );

        let created = 0;
        let defaulted = 0;

        for (const r of rows) {
          if (r.is_cancelled || r.financial_state === "financially_cleared") continue;

          const b = byId.get(r.event_id);
          const eventLabel = b?.event_name ?? r.ref;
          const vars = {
            event: eventLabel,
            event_date: r.event_date,
            city: b?.city ?? "",
            due_date: r.balance_due_on,
            outstanding: r.outstanding_lsl.toLocaleString(),
          };

          // Bucket by days-to-due
          const d = r.days_to_balance_due;
          let rule: ReminderRule | null = null;
          if (d === 14) rule = "reminder_21d";
          else if (d === 7) rule = "reminder_14d";
          else if (d === 3) rule = "reminder_10d";
          else if (d === 0) rule = "reminder_final_notice";

          if (rule) {
            const meta = REMINDER_META[rule];
            const body = renderTemplate(meta.body, vars);
            const { error: nErr } = await supabaseAdmin
              .from("notifications")
              .insert({
                event_id: r.event_id,
                rule,
                target_role: "admin",
                severity: meta.severity,
                title: meta.title,
                body,
              });
            // Unique partial index dedupes; ignore duplicate errors
            if (!nErr) {
              created++;
              await supabaseAdmin.from("event_messages").insert({
                event_id: r.event_id,
                channel: "in_app",
                direction: "internal",
                kind: "system",
                body: `[${meta.title}] ${body}`,
                meta: { rule } as never,
              });
              if (rule === "reminder_final_notice") {
                await supabaseAdmin.from("event_timeline").insert({
                  event_id: r.event_id,
                  stage: "financial_lock_engaged",
                  payload: { rule, due_date: r.balance_due_on } as never,
                });
              }
            }
          }

          // Post-deadline default
          if (
            r.financial_state === "payment_default" &&
            !r.has_continuation
          ) {
            const meta = REMINDER_META.payment_default;
            const body = renderTemplate(meta.body, vars);
            const { error: nErr } = await supabaseAdmin.from("notifications").insert({
              event_id: r.event_id,
              rule: "payment_default",
              target_role: "admin",
              severity: "critical",
              title: meta.title,
              body,
            });
            if (!nErr) {
              defaulted++;
              await supabaseAdmin.from("event_timeline").insert({
                event_id: r.event_id,
                stage: "payment_default",
                payload: { rule: "payment_default" } as never,
              });
            }
          }
        }

        return Response.json({ ok: true, processed: rows.length, created, defaulted });
      },
    },
  },
});

// Silence unused import warning; createClient kept for future service-role fallbacks.
void createClient;
