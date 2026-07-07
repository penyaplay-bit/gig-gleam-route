// Public POP upload: promoter uploads proof of payment for a booking by ref.
// Accepts multipart/form-data with a `file` field and `method` + `reference`.
import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export const Route = createFileRoute("/api/public/deposits/$ref")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ref = params.ref;
        if (!ref) return Response.json({ error: "Missing ref" }, { status: 400 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "multipart/form-data expected" }, { status: 400 });
        }

        const file = form.get("file");
        const method = String(form.get("method") ?? "bank_transfer").slice(0, 40);
        const reference = String(form.get("reference") ?? "").slice(0, 160);

        if (!(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
        if (file.size <= 0 || file.size > MAX_BYTES) {
          return Response.json({ error: `File must be ≤ ${MAX_BYTES / 1024 / 1024} MB` }, { status: 400 });
        }
        if (!ALLOWED.includes(file.type)) {
          return Response.json({ error: "File must be PNG, JPG, WEBP or PDF" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: booking, error: bErr } = await supabaseAdmin
          .from("bookings")
          .select("id, deposit_amount, quoted_amount, status")
          .eq("ref", ref)
          .maybeSingle();
        if (bErr) return Response.json({ error: bErr.message }, { status: 500 });
        if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });
        if (!booking.quoted_amount) {
          return Response.json({ error: "No quote issued yet for this booking" }, { status: 400 });
        }

        // Store at pop/{ref}/{timestamp}-{safeName}
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const path = `pop/${ref}/${Date.now()}-${safe}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const { error: upErr } = await supabaseAdmin.storage
          .from("deposits")
          .upload(path, bytes, { contentType: file.type, upsert: false });
        if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

        const amount = booking.deposit_amount ?? 0;
        const { data: dep, error: dErr } = await supabaseAdmin
          .from("deposits")
          .insert({
            booking_id: booking.id,
            amount,
            pop_path: path,
            method,
            reference: reference || null,
            uploaded_at: new Date().toISOString(),
            status: "uploaded",
          })
          .select("id")
          .single();
        if (dErr) return Response.json({ error: dErr.message }, { status: 500 });

        // Set booking to deposit_pending if it isn't already further along
        if (["new", "reviewing", "quote_sent", "offer_submitted", "counter_offer"].includes(booking.status)) {
          await supabaseAdmin.from("bookings").update({ status: "deposit_pending" }).eq("id", booking.id);
        }

        return Response.json({ ok: true, deposit_id: dep.id });
      },
    },
  },
});
