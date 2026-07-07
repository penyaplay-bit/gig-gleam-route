import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public quotation-request endpoint. No auth (deliberately under /api/public/*).
// GET  → list of bookable artists + their public estimated fee range (never the exact base fee).
// POST → create a booking lead + notify admin; returns a ref + coarse estimated range.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const InputSchema = z.object({
  artist_profile_id: z.string().uuid(),
  event_name: z.string().trim().min(2).max(200),
  event_type: z.string().trim().min(2).max(80),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  venue: z.string().trim().min(2).max(200),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(1).max(80),
  crowd_size: z.number().int().min(10).max(500000),
  contact_name: z.string().trim().min(2).max(120),
  contact_email: z.string().trim().email().max(200),
  contact_phone: z.string().trim().min(6).max(40),
  contact_whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

function bracketRange(baseFeeCents: number) {
  // Public estimate is deliberately coarse: fee + logistics envelope, snapped to R5,000.
  const SNAP = 500_000; // R5,000 in cents
  const low = Math.round((baseFeeCents * 1.15) / SNAP) * SNAP;
  const high = Math.round((baseFeeCents * 1.7) / SNAP) * SNAP;
  return { low, high };
}

function newRef() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `RQ-${stamp}-${rand}`;
}

export const Route = createFileRoute("/api/public/quote-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("artist_profiles")
          .select("id, name, currency, base_fee, home_city, home_country_code, default_team_size, active")
          .eq("active", true)
          .order("name");
        if (error) {
          return Response.json({ error: error.message }, { status: 500, headers: CORS });
        }
        const artists = (data ?? []).map((p) => {
          const { low, high } = bracketRange(p.base_fee);
          return {
            id: p.id,
            name: p.name,
            currency: p.currency,
            home_city: p.home_city,
            home_country_code: p.home_country_code,
            team_size: p.default_team_size,
            estimated_low: low,
            estimated_high: high,
          };
        });
        return Response.json({ artists }, { headers: CORS });
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
        }
        const parsed = InputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Validation failed", issues: parsed.error.flatten() },
            { status: 400, headers: CORS },
          );
        }
        const input = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profile, error: profileErr } = await supabaseAdmin
          .from("artist_profiles")
          .select("id, name, base_fee, currency, artist_id, active")
          .eq("id", input.artist_profile_id)
          .maybeSingle();
        if (profileErr || !profile || !profile.active || !profile.artist_id) {
          return Response.json(
            { error: "Artist is not available for booking." },
            { status: 400, headers: CORS },
          );
        }

        const { low, high } = bracketRange(profile.base_fee);
        const ref = newRef();

        const { data: booking, error: insertErr } = await supabaseAdmin
          .from("bookings")
          .insert({
            ref,
            artist_id: profile.artist_id,
            event_name: input.event_name,
            event_type: input.event_type,
            event_date: input.event_date,
            venue: input.venue,
            city: input.city,
            country: input.country,
            crowd_size: input.crowd_size,
            contact_name: input.contact_name,
            contact_email: input.contact_email,
            contact_phone: input.contact_phone,
            contact_whatsapp: input.contact_whatsapp || null,
            preferred_contact: input.contact_whatsapp ? "whatsapp" : "email",
            description: input.description || null,
            status: "new",
          })
          .select("id, ref")
          .single();

        if (insertErr || !booking) {
          console.error("[quote-request] insert failed:", insertErr);
          return Response.json(
            { error: "Could not save your request. Please try again." },
            { status: 500, headers: CORS },
          );
        }

        // Fire-and-forget admin notification.
        await supabaseAdmin.from("notifications").insert({
          event_id: booking.id,
          rule: "quote_request_received",
          target_role: "admin",
          severity: "info",
          title: `New quotation request — ${input.event_name}`,
          body: `${profile.name} · ${input.city}, ${input.country} · ${input.crowd_size.toLocaleString()} crowd · ${input.contact_name}`,
          meta: {
            ref: booking.ref,
            artist_profile_id: profile.id,
            contact_email: input.contact_email,
            contact_phone: input.contact_phone,
            estimated_low: low,
            estimated_high: high,
          },
        });

        return Response.json(
          {
            ok: true,
            ref: booking.ref,
            status: "under_review",
            estimated_range: { low, high, currency: profile.currency },
            message:
              "Your quotation request has been received. Our team will confirm a formal quotation shortly.",
          },
          { status: 201, headers: CORS },
        );
      },
    },
  },
});
