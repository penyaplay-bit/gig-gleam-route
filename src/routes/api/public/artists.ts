// Public list of active artists + their packages, for the booking form.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/artists")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [aRes, pRes] = await Promise.all([
          supabaseAdmin
            .from("artists")
            .select("id, slug, name, tagline, home_city, home_address, base_fee, photo")
            .eq("active", true)
            .order("name"),
          supabaseAdmin
            .from("packages")
            .select("id, artist_id, name, description, base_price, crew_size, duration_minutes, sort_order")
            .eq("active", true)
            .order("sort_order"),
        ]);
        if (aRes.error) return Response.json({ error: aRes.error.message }, { status: 500 });
        if (pRes.error) return Response.json({ error: pRes.error.message }, { status: 500 });
        return Response.json({ artists: aRes.data ?? [], packages: pRes.data ?? [] });
      },
    },
  },
});
