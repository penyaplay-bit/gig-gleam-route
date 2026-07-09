// Public driving-distance lookup for the booking form.
// The origin address is resolved server-side from the artist id so home
// addresses never leave the server.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const Body = z.object({
  artist_id: z.string().uuid(),
  destination: z.string().min(2).max(300),
});

export const Route = createFileRoute("/api/public/distance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const lovKey = process.env.LOVABLE_API_KEY;
        const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!lovKey || !mapsKey) {
          return Response.json({ error: "Maps not configured" }, { status: 503 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: artist, error: aErr } = await supabaseAdmin
          .from("artists")
          .select("home_address, home_city, active")
          .eq("id", parsed.data.artist_id)
          .maybeSingle();
        if (aErr) return Response.json({ error: "Artist lookup failed" }, { status: 500 });
        if (!artist || artist.active === false) {
          return Response.json({ error: "Artist not found" }, { status: 404 });
        }
        const origin = artist.home_address || artist.home_city;
        if (!origin) {
          return Response.json({ error: "Artist origin not configured" }, { status: 404 });
        }

        const resp = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovKey}`,
            "X-Connection-Api-Key": mapsKey,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify({
            origin: { address: origin },
            destination: { address: parsed.data.destination },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
            units: "METRIC",
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.error(`[public/distance] gateway ${resp.status}: ${body}`);
          return Response.json({ error: `Distance lookup failed (${resp.status})` }, { status: 502 });
        }
        const json: {
          routes?: Array<{ distanceMeters?: number; duration?: string }>;
        } = await resp.json();
        const route = json.routes?.[0];
        if (!route?.distanceMeters) {
          return Response.json({ error: "No route found" }, { status: 404 });
        }
        const distance_km = Math.round(route.distanceMeters / 1000);
        const duration_min = Math.round(
          Number((route.duration ?? "0s").replace("s", "")) / 60,
        );
        return Response.json({
          distance_km,
          duration_min,
          overnight_recommended: distance_km > 150,
        });
      },
    },
  },
});
