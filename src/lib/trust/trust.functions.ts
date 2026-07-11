// Trust & verification server functions.
// Level 1 (email) is auto-marked when Supabase confirms the email.
// Family Event badge (T5) is earned via 2+ references + child-safety attestation.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_REFERENCES_FOR_FAMILY_BADGE } from "@/lib/trust/thresholds";

// ---------- Read own trust ----------
export const getMyTrust = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: user }, { data: performer }] = await Promise.all([
      supabase.from("user_trust").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("performer_trust").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return { user, performer };
  });

// ---------- Ensure row exists ----------
export const ensureTrustRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_trust").upsert(
      { user_id: userId, level: 0 },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    return { ok: true };
  });

// ---------- Family-Event attestation (T5) ----------
const AttestationInput = z.object({
  attestation_agreed: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the child-safety attestation" }),
  }),
  references: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        role: z.string().trim().min(2).max(100),
        contact: z.string().trim().min(5).max(200), // phone or email
        event_type: z.string().trim().max(100).optional().default(""),
      }),
    )
    .min(MIN_REFERENCES_FOR_FAMILY_BADGE, `At least ${MIN_REFERENCES_FOR_FAMILY_BADGE} references required`),
});

export const submitFamilyAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AttestationInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    // Ensure performer_trust row
    const { error: upErr } = await supabase.from("performer_trust").upsert(
      {
        user_id: userId,
        references_count: data.references.length,
        family_event_verified_at: now, // v1: attestation-based; upgrade to full check later
        updated_at: now,
      },
      { onConflict: "user_id" },
    );
    if (upErr) throw new Error(upErr.message);

    // Audit event with references payload
    await supabase.from("trust_events").insert({
      user_id: userId,
      kind: "family_event_attestation_submitted",
      detail: {
        references_count: data.references.length,
        references: data.references,
        method: "attestation_v1",
      },
    });

    return {
      ok: true,
      family_event_verified_at: now,
      references_count: data.references.length,
    };
  });

// ---------- Withdraw Family-Event badge (self-service) ----------
export const withdrawFamilyAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("performer_trust").update({
      family_event_verified_at: null,
      references_count: 0,
    }).eq("user_id", userId);
    await supabase.from("trust_events").insert({
      user_id: userId,
      kind: "family_event_attestation_withdrawn",
    });
    return { ok: true };
  });

// ---------- Derived: which badges to show for a user ----------
export type TrustBadgeKind =
  | "identity" | "family_event" | "business" | "payment_protected"
  | "highly_rated" | "booking_history";

export function deriveBadges(input: {
  user?: { id_verified_at?: string | null; business_verified_at?: string | null } | null;
  performer?: { family_event_verified_at?: string | null } | null;
  completedBookings?: number;
  avgRating?: number | null;
}): TrustBadgeKind[] {
  const out: TrustBadgeKind[] = [];
  if (input.user?.id_verified_at) out.push("identity");
  if (input.performer?.family_event_verified_at) out.push("family_event");
  if (input.user?.business_verified_at) out.push("business");
  if ((input.completedBookings ?? 0) >= 5) out.push("booking_history");
  if ((input.avgRating ?? 0) >= 4.5) out.push("highly_rated");
  // Payment Protected is a platform-level guarantee on every booking
  out.push("payment_protected");
  return out;
}
