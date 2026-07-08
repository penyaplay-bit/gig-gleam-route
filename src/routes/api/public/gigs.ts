// Public JSON API for the gig marketplace — safe columns, approved+open only.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/gigs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const city = url.searchParams.get("city") ?? undefined;
        const genre = url.searchParams.get("genre") ?? undefined;
        const minBudget = Number(url.searchParams.get("min_budget") ?? "0");

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const today = new Date().toISOString().slice(0, 10);
        let q = supabase
          .from("gigs")
          .select(
            "id, event_name, event_type, event_date, venue, city, country, crowd_size, budget_low_cents, budget_high_cents, currency, genre_needed, artist_type_needed, application_deadline, status, promoter_profiles(company_name, verified, trust_score)"
          )
          .in("status", ["open", "reviewing", "shortlisted"])
          .gte("application_deadline", today)
          .order("application_deadline", { ascending: true })
          .limit(50);
        if (city) q = q.ilike("city", `%${city}%`);
        if (genre) q = q.contains("genre_needed", [genre]);
        if (minBudget > 0) q = q.gte("budget_high_cents", Math.round(minBudget * 100));
        const { data, error } = await q;
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ gigs: data ?? [] }, {
          headers: { "cache-control": "public, max-age=30" },
        });
      },
    },
  },
});
