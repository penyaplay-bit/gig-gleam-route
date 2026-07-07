import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeQuote,
  type ArtistProfileConfig,
  type QuoteInputs,
  type QuoteResult,
} from "./artist-engine";

// ------------------------------------------------------------------
// List artist profiles (signed-in users can see active ones)
// ------------------------------------------------------------------

export const listArtistProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("artist_profiles")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return { profiles: (data ?? []) as unknown as ArtistProfileConfig[] };
  });

export const getArtistProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("artist_profiles")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { profile: row as unknown as ArtistProfileConfig };
  });

// ------------------------------------------------------------------
// Preview a quote (no persistence)
// ------------------------------------------------------------------

const QuoteInputsSchema = z.object({
  event_name: z.string().min(1).max(200),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_type: z.string().min(1).max(80),
  venue: z.string().max(200).optional(),
  country: z.string().min(1).max(80),
  city: z.string().max(120).optional(),
  attendance: z.number().int().nonnegative().optional(),
  team_size: z.number().int().positive().max(50).optional(),
  distance_km: z.number().nonnegative().max(20000).optional(),
  cross_border: z.boolean().optional(),
  overnight_required: z.boolean().optional(),
  flights_required: z.boolean().optional(),
  extra_nights: z.number().int().nonnegative().max(30).optional(),
  security_required: z.boolean().optional(),
  equipment_cost: z.number().int().nonnegative().optional(),
  security_cost: z.number().int().nonnegative().optional(),
  tax_pct: z.number().nonnegative().max(50).optional(),
  discount: z.number().int().nonnegative().optional(),
  fee_override: z.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const previewQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        profile_id: z.string().uuid(),
        inputs: QuoteInputsSchema,
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<QuoteResult> => {
    const { data: profile, error } = await context.supabase
      .from("artist_profiles")
      .select("*")
      .eq("id", data.profile_id)
      .single();
    if (error || !profile) throw new Error(error?.message ?? "Profile not found");
    return computeQuote(profile as unknown as ArtistProfileConfig, data.inputs as QuoteInputs);
  });

// ------------------------------------------------------------------
// AI pricing suggestion (with profitability floor)
// ------------------------------------------------------------------

export const aiSuggestPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        profile_id: z.string().uuid(),
        inputs: QuoteInputsSchema,
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { data: profile, error } = await context.supabase
      .from("artist_profiles")
      .select("*")
      .eq("id", data.profile_id)
      .single();
    if (error || !profile) throw new Error(error?.message ?? "Profile not found");

    const cfg = profile as unknown as ArtistProfileConfig;
    const baseQuote = computeQuote(cfg, data.inputs as QuoteInputs);

    const system = `You are a pricing strategist for a South African artist booking agency.
Given an artist profile and a booking brief, suggest a performance fee adjustment factor.
Return strict JSON with these fields:
- suggested_fee_cents: integer, in cents
- multiplier: number (e.g. 1.15 = +15%)
- reasoning: string (2-3 sentences)
- risk_score: integer 0-100
- confidence: "low" | "medium" | "high"

Rules:
- Consider: audience size, event prestige/type, distance, seasonality, promoter history, availability, risk.
- NEVER suggest a fee that would make the total quote fall below the minimum acceptable total.
- Prefer upward adjustments for high-prestige, high-audience, peak-season, or long-distance events.`;

    const user = JSON.stringify({
      artist: { name: cfg.name, base_fee_cents: cfg.base_fee },
      inputs: data.inputs,
      current_quote: {
        fee_total: baseQuote.fee_total,
        logistics_total: baseQuote.logistics_total,
        total: baseQuote.total,
        min_acceptable_total: baseQuote.min_acceptable_total,
      },
    });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[AI] gateway ${resp.status}: ${body}`);
      if (resp.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Top up in workspace billing.");
      throw new Error(`AI suggestion failed (${resp.status})`);
    }
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: {
      suggested_fee_cents?: number;
      multiplier?: number;
      reasoning?: string;
      risk_score?: number;
      confidence?: string;
    } = {};
    try { parsed = JSON.parse(content); } catch { /* keep empty */ }

    const suggested = Math.max(
      Math.round(parsed.suggested_fee_cents ?? cfg.base_fee),
      cfg.base_fee, // never suggest lower than base fee
    );
    return {
      suggested_fee_cents: suggested,
      multiplier: parsed.multiplier ?? 1,
      reasoning: parsed.reasoning ?? "",
      risk_score: parsed.risk_score ?? 0,
      confidence: (parsed.confidence as "low" | "medium" | "high") ?? "low",
      floor_cents: baseQuote.min_acceptable_total,
    };
  });
