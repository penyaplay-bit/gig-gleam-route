// Public read-only endpoint: fetch a booking + linked artist/package by its reference code.
// Used by /book/confirm/$ref and /pay/$ref (both public-facing).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bookings/$ref")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ref = params.ref;
        if (!ref || ref.length > 20) return Response.json({ error: "Invalid ref" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("bookings")
          .select(
            "id, ref, event_name, event_date, city, country, venue, status, quoted_amount, deposit_amount, deposit_pct, balance_amount, contact_name, artists(name, slug), packages(name), deposits(id, status, uploaded_at, verified_at)",
          )
          .eq("ref", ref)
          .maybeSingle();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!data) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({ booking: data });
      },
    },
  },
});
