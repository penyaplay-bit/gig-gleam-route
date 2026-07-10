// Slice A — universal onboarding: intents + reserved handle.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IntentEnum = z.enum([
  "get_booked", "hire_talent", "list_venue", "organize_events",
  "provide_services", "manage_talent", "represent_brand",
]);

const HandleKind = z.enum(["performer", "venue", "promoter", "supplier", "brand", "manager"]);

const SaveInput = z.object({
  intents: z.array(IntentEnum).min(1),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,31}$/,
    "Handle must be 3-32 chars, letters/numbers/-/_ only"),
  handleKind: HandleKind,
  displayName: z.string().trim().min(1).max(80),
});

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check handle availability (unique on citext PK)
    const { data: existing } = await supabase
      .from("handles")
      .select("handle,user_id")
      .eq("handle", data.handle)
      .maybeSingle();
    if (existing && existing.user_id !== userId) {
      throw new Error(`Handle "${data.handle}" is already taken`);
    }

    // Upsert intents (delete + insert to keep set fresh)
    await supabase.from("profile_intents").delete().eq("user_id", userId);
    const rows = data.intents.map((intent) => ({ user_id: userId, intent }));
    const { error: intentsErr } = await supabase.from("profile_intents").insert(rows);
    if (intentsErr) throw intentsErr;

    // Free any previous handle for this user, then upsert new one
    await supabase.from("handles").delete().eq("user_id", userId);
    const { error: hErr } = await supabase.from("handles").insert({
      handle: data.handle,
      user_id: userId,
      kind: data.handleKind,
      display_name: data.displayName,
    });
    if (hErr) throw hErr;

    return { ok: true, handle: data.handle };
  });

export const getMyOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [intents, handle] = await Promise.all([
      supabase.from("profile_intents").select("intent").eq("user_id", userId),
      supabase.from("handles").select("handle,kind,display_name").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      intents: (intents.data ?? []).map((r) => r.intent),
      handle: handle.data,
    };
  });

// Public loader for the Booking Button page — anon-safe.
const BookingSlug = z.object({ handle: z.string().min(1).max(64) });

export const getBookingButtonProfile = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => BookingSlug.parse(d))
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: h } = await supabase
      .from("handles")
      .select("handle,user_id,kind,display_name")
      .eq("handle", data.handle)
      .maybeSingle();
    if (!h) return { handle: null, profile: null };

    // Only expose public columns for performer handles for now.
    if (h.kind !== "performer") {
      return { handle: h, profile: null };
    }

    const { data: p } = await supabase
      .from("performer_public")
      .select("*")
      .eq("user_id", h.user_id)
      .maybeSingle();

    return { handle: h, profile: p };
  });
