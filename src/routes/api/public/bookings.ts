// Public booking submission endpoint. No auth. Validates + writes via service role.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { computeScore, guessDistanceKm } from "@/lib/booking-score";
import { daysBetween, newBookingRef } from "@/lib/formatting";

const BookingSubmission = z.object({
  artist_id: z.string().uuid(),
  package_id: z.string().uuid().optional().nullable(),

  event_type: z.string().min(1).max(80),
  event_name: z.string().min(1).max(160),
  venue: z.string().max(160).optional().nullable(),
  city: z.string().min(1).max(80),
  country: z.string().min(1).max(80).default("Lesotho"),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  start_time: z.string().max(20).optional().nullable(),
  end_time: z.string().max(20).optional().nullable(),
  ends_after_10pm: z.boolean().default(false),

  crowd_size: z.number().int().min(0).max(500_000).optional().nullable(),
  ticket_price: z.number().int().min(0).max(50_000).optional().nullable(),
  has_sponsors: z.boolean().default(false),
  has_media: z.boolean().default(false),
  event_class: z.enum(["private", "corporate", "festival", "televised"]).default("private"),

  client_offer: z.number().int().min(0).max(10_000_000).optional().nullable(),
  budget_min: z.number().int().min(0).max(10_000_000).optional().nullable(),
  deposit_ready: z.boolean().default(false),
  proof_link: z.string().url().max(500).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),

  contact_name: z.string().min(1).max(120),
  contact_email: z.string().email().max(200),
  contact_phone: z.string().max(40).optional().nullable(),
  contact_whatsapp: z.string().max(40).optional().nullable(),
  contact_company: z.string().max(160).optional().nullable(),
  preferred_contact: z.enum(["whatsapp", "email", "phone"]).default("whatsapp"),
  description: z.string().max(4000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/bookings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = BookingSubmission.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
        }
        const s = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Upsert promoter by email
        const { data: existing, error: eSel } = await supabaseAdmin
          .from("promoters")
          .select("*")
          .eq("email", s.contact_email)
          .maybeSingle();
        if (eSel) return Response.json({ error: eSel.message }, { status: 500 });

        let promoterId = existing?.id as string | undefined;
        if (!promoterId) {
          const { data: p, error: eIns } = await supabaseAdmin
            .from("promoters")
            .insert({
              name: s.contact_name,
              company: s.contact_company ?? null,
              email: s.contact_email,
              phone: s.contact_phone ?? null,
              whatsapp: s.contact_whatsapp ?? null,
              country: s.country,
              city: s.city,
            })
            .select("id")
            .single();
          if (eIns) return Response.json({ error: eIns.message }, { status: 500 });
          promoterId = p.id;
        }

        // Load package base price for scoring
        let packageBase = 50_000;
        if (s.package_id) {
          const { data: pkg } = await supabaseAdmin
            .from("packages")
            .select("base_price")
            .eq("id", s.package_id)
            .maybeSingle();
          if (pkg) packageBase = pkg.base_price;
        }

        // Score it
        const daysOut = Math.max(0, daysBetween(new Date(), s.event_date));
        const distanceKm = guessDistanceKm(s.city);
        const isRepeat = !!existing && (existing.bookings_count ?? 0) > 0;
        const score = computeScore({
          budgetMin: s.budget_min ?? null,
          clientOffer: s.client_offer ?? null,
          packageBasePrice: packageBase,
          depositReady: s.deposit_ready,
          companyProvided: !!s.contact_company,
          crowdSize: s.crowd_size ?? null,
          ticketPrice: s.ticket_price ?? null,
          hasSponsors: s.has_sponsors,
          hasMedia: s.has_media,
          distanceKm,
          daysOut,
          isRepeatPromoter: isRepeat,
          promoterReliability: existing?.reliability_score ?? 50,
          blacklisted: !!existing?.blacklisted,
          proofLinkProvided: !!s.proof_link,
        });

        // Create booking with a unique ref (retry on collision)
        let ref = newBookingRef();
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: b, error: eIns } = await supabaseAdmin
            .from("bookings")
            .insert({
              ref,
              artist_id: s.artist_id,
              promoter_id: promoterId,
              package_id: s.package_id ?? null,
              event_type: s.event_type,
              event_name: s.event_name,
              venue: s.venue ?? null,
              city: s.city,
              country: s.country,
              event_date: s.event_date,
              start_time: s.start_time ?? null,
              end_time: s.end_time ?? null,
              ends_after_10pm: s.ends_after_10pm,
              crowd_size: s.crowd_size ?? null,
              ticket_price: s.ticket_price ?? null,
              has_sponsors: s.has_sponsors,
              has_media: s.has_media,
              event_class: s.event_class,
              client_offer: s.client_offer ?? null,
              budget_min: s.budget_min ?? null,
              deposit_ready: s.deposit_ready,
              proof_link: s.proof_link ?? null,
              contact_name: s.contact_name,
              contact_email: s.contact_email,
              contact_phone: s.contact_phone ?? null,
              contact_whatsapp: s.contact_whatsapp ?? null,
              preferred_contact: s.preferred_contact,
              description: s.description ?? null,
              status: "new",
              score: score.total,
              score_breakdown: JSON.parse(JSON.stringify(score)),
            })
            .select("id, ref")
            .maybeSingle();
          if (!eIns && b) {
            return Response.json({ ok: true, ref: b.ref, id: b.id, score });
          }
          if (eIns && String(eIns.message).includes("bookings_ref_key")) {
            ref = newBookingRef();
            continue;
          }
          return Response.json({ error: eIns?.message ?? "Insert failed" }, { status: 500 });
        }
        return Response.json({ error: "Could not generate unique reference" }, { status: 500 });
      },
    },
  },
});
