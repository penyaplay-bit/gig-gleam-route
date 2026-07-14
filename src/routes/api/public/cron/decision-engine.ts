// Decision Engine cron route.
// Called by pg_cron on two schedules:
//   */5 * * * *  → mode=stale (fast reaction to graph writes)
//   0 3 * * *    → mode=all   (nightly sweep; picks up time-based transitions)
//
// Auth: standard `apikey` header (anon key). No custom secret.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/decision-engine")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const expected = process.env.CRON_SECRET ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { mode?: "stale" | "all"; limit?: number } = {};
        try { body = (await request.json()) as typeof body; } catch { /* empty body ok */ }
        const mode = body.mode ?? "stale";
        const limit = body.limit ?? 200;

        const { evaluateStale, evaluateAll } = await import("@/lib/engines/decision.server");
        const result = mode === "all" ? await evaluateAll() : await evaluateStale(limit);

        return new Response(JSON.stringify({ ok: true, mode, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
