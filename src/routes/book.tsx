// Mzansi-warm, one-question-at-a-time booking flow.
// Every field is its own screen with a slide transition. Enter to continue.
// Answers auto-save to localStorage so a refresh never loses your progress.
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CalendarIcon, CornerDownLeft, BedDouble, MapPin, FileDown, Sparkles, RotateCcw } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo-mark";
import { GrainOverlay } from "@/components/brand/grain";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SADC_COUNTRIES, OTHER_AFRICA, citiesFor } from "@/lib/africa-locations";
import { jsPDF } from "jspdf";

// Landing funnel keys → booking event_type values
const FUNNEL_TO_EVENT_TYPE: Record<string, string> = {
  birthday: "Private party",
  wedding: "Wedding",
  corporate: "Corporate",
  school: "Private party",
  club: "Concert",
  family: "Private party",
  festival: "Festival",
  other: "Other",
};

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>) => ({
    event_type: typeof s.event_type === "string" ? s.event_type : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book a gig — Penya Play" },
      { name: "description", content: "Book Ntate Stunna or any Penya Play artist. One question at a time, sharp sharp." },
    ],
  }),
  component: BookingFlow,
});

interface Artist {
  id: string;
  name: string;
  tagline: string | null;
  home_city: string;
  base_fee: number;
  photo: string | null;
  slug: string;
}
interface Pkg {
  id: string;
  artist_id: string;
  name: string;
  description: string | null;
  base_price: number;
  crew_size: number;
  duration_minutes: number | null;
}

type ContactChannel = "whatsapp" | "email" | "phone";

interface Form {
  artist_id: string;
  package_id: string | null;
  event_type: string;
  event_name: string;
  venue: string;
  city: string;
  country: string;
  event_date: string;
  start_time: string;
  end_time: string;
  ends_after_10pm: boolean;
  crowd_size: string;
  ticket_price: string;
  has_sponsors: boolean;
  has_media: boolean;
  event_class: "private" | "corporate" | "festival" | "televised";
  client_offer: string;
  budget_min: string;
  deposit_ready: boolean;
  proof_link: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  contact_whatsapp: string;
  contact_company: string;
  contact_channels: ContactChannel[];
  preferred_contact: ContactChannel;
  description: string;
}

const EVENT_TYPES = [
  { v: "Wedding", label: "Umshado", emoji: "💍" },
  { v: "Private party", label: "Private jol", emoji: "🎉" },
  { v: "Corporate", label: "Corporate gig", emoji: "💼" },
  { v: "Festival", label: "Festival", emoji: "🎪" },
  { v: "Church event", label: "Church event", emoji: "⛪" },
  { v: "Concert", label: "Concert", emoji: "🎤" },
  { v: "Product launch", label: "Product launch", emoji: "🚀" },
  { v: "Other", label: "Something else", emoji: "✨" },
];

const EVENT_CLASSES = [
  { v: "private", label: "Private", sub: "Just my people" },
  { v: "corporate", label: "Corporate", sub: "Brand or company" },
  { v: "festival", label: "Festival", sub: "Ticketed, public" },
  { v: "televised", label: "Televised", sub: "Broadcast / stream" },
] as const;

const CONTACT_PREF: { v: ContactChannel; label: string; emoji: string; sub: string }[] = [
  { v: "whatsapp", label: "WhatsApp", emoji: "💬", sub: "Fastest — we live here" },
  { v: "email", label: "Email", emoji: "📧", sub: "Paper trail, quotes & contracts" },
  { v: "phone", label: "Phone call", emoji: "📞", sub: "Old school, still works" },
];

const DRAFT_KEY = "penyaplay:booking:draft:v2";

const EMPTY_FORM: Form = {
  artist_id: "",
  package_id: null,
  event_type: "",
  event_name: "",
  venue: "",
  city: "",
  country: "Lesotho",
  event_date: "",
  start_time: "",
  end_time: "",
  ends_after_10pm: false,
  crowd_size: "",
  ticket_price: "",
  has_sponsors: false,
  has_media: false,
  event_class: "private",
  client_offer: "",
  budget_min: "",
  deposit_ready: false,
  proof_link: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  contact_whatsapp: "",
  contact_company: "",
  contact_channels: ["whatsapp", "email", "phone"],
  preferred_contact: "whatsapp",
  description: "",
};

function loadDraft(): { f: Form; q: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { f?: Partial<Form>; q?: number };
    if (!j?.f) return null;
    return { f: { ...EMPTY_FORM, ...j.f, contact_channels: (j.f.contact_channels?.length ? j.f.contact_channels : ["whatsapp", "email", "phone"]) as ContactChannel[] }, q: Math.max(0, j.q ?? 0) };
  } catch {
    return null;
  }
}

function BookingFlow() {
  const navigate = useNavigate();
  const restored = useMemo(() => loadDraft(), []);
  const [q, setQ] = useState<number>(restored?.q ?? 0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Form>(restored?.f ?? EMPTY_FORM);
  const [savedFlash, setSavedFlash] = useState(false);
  const firstSave = useRef(true);

  const { data } = useQuery({
    queryKey: ["public-artists"],
    queryFn: async () => {
      const r = await fetch("/api/public/artists");
      if (!r.ok) throw new Error("Failed to load artists");
      return (await r.json()) as { artists: Artist[]; packages: Pkg[] };
    },
  });

  const artists = data?.artists ?? [];
  const packagesFor = (aid: string) => (data?.packages ?? []).filter((p) => p.artist_id === aid);
  const artist = artists.find((a) => a.id === f.artist_id);
  const pkg = (data?.packages ?? []).find((p) => p.id === f.package_id);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  // Auto-save every change (debounced) + before unload
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ f, q }));
        if (firstSave.current) { firstSave.current = false; return; }
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 900);
      } catch { /* quota — ignore */ }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [f, q]);

  // On step change, glide the card into view so the next question feels rewarding
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rect = el.getBoundingClientRect();
    // Only scroll if the top of the card isn't comfortably in view
    if (rect.top < 0 || rect.top > 140) {
      window.scrollTo({ top: window.scrollY + rect.top - 88, behavior: prefersReduced ? "auto" : "smooth" });
    }
  }, [q]);


  useEffect(() => {
    const onBeforeUnload = () => {
      try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ f, q })); } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [f, q]);

  // One-time toast if we restored a draft
  useEffect(() => {
    if (restored) toast.success("Welcome back — picked up right where you left off.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetDraft() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setF(EMPTY_FORM);
    setQ(0);
    setDir(-1);
    toast.message("Fresh start — clean slate.");
  }

  // Auto-select if only one artist
  useEffect(() => {
    if (!f.artist_id && artists.length === 1) setF((x) => ({ ...x, artist_id: artists[0].id }));
  }, [artists, f.artist_id]);

  // Autofill from signed-in user (only fills blanks)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u || cancelled) return;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        "";
      const phone =
        (typeof meta.phone === "string" && meta.phone) ||
        (typeof u.phone === "string" && u.phone) ||
        "";
      const company = (typeof meta.company === "string" && meta.company) || "";
      setF((x) => ({
        ...x,
        contact_email: x.contact_email || u.email || "",
        contact_name: x.contact_name || name,
        contact_phone: x.contact_phone || phone,
        contact_whatsapp: x.contact_whatsapp || phone,
        contact_company: x.contact_company || company,
      }));
    })();
    return () => { cancelled = true; };
  }, []);

  // Distance lookup
  const [distance, setDistance] = useState<{ km: number; minutes: number; overnight: boolean; destination: string } | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  useEffect(() => {
    const artistId = artist?.id;
    const destination = [f.venue, f.city, f.country].filter(Boolean).join(", ");
    if (!artistId || !f.city.trim()) { setDistance(null); return; }
    const handle = setTimeout(async () => {
      setDistanceLoading(true);
      try {
        const r = await fetch("/api/public/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artist_id: artistId, destination }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "");
        setDistance({ km: j.distance_km, minutes: j.duration_min, overnight: !!j.overnight_recommended, destination });
        if (j.overnight_recommended) setF((x) => (x.ends_after_10pm ? x : { ...x, ends_after_10pm: true }));
      } catch { setDistance(null); }
      finally { setDistanceLoading(false); }
    }, 600);
    return () => clearTimeout(handle);
  }, [artist?.id, f.city, f.country, f.venue]);

  // Warmer, more psychologically-smart copy — like a friendly local manager
  const questions = useMemo(() => {
    const qs: Question[] = [];
    qs.push({ id: "artist", kind: "artist", title: "Howzit 👋 — who's headlining?", sub: "Tap the one you want on stage. No wrong answers." });
    if (f.artist_id) qs.push({ id: "package", kind: "package", title: "Pick a package to start from", sub: "This is just the baseline — travel & event size adjust the final quote." });
    qs.push({ id: "event_type", kind: "event_type", title: "What kind of vibe are we cooking?", sub: "So we send the right energy your way." });
    qs.push({ id: "event_name", kind: "text", title: "Give the event a name", sub: "Something you'll spot in your inbox — e.g. \"Nkopane's 40th\".", field: "event_name", placeholder: "Event name", required: true });
    qs.push({ id: "country", kind: "country", title: "Which country's it in?", sub: "Helps us line up the right crew." });
    qs.push({ id: "city", kind: "city", title: "And which city?", sub: "We'll work out the drive automatically." });
    qs.push({ id: "venue", kind: "text", title: "Venue name?", sub: "No stress if you haven't locked it in — skip it.", field: "venue", placeholder: "e.g. Maseru Sun", optional: true });
    qs.push({ id: "event_date", kind: "date", title: "When's the big day?", sub: "Fridays and Saturdays fill up fast — earlier is better." });
    qs.push({ id: "time", kind: "time", title: "Roughly what time?", sub: "A ballpark is fine. We just want to plan travel like a pro." });
    qs.push({ id: "event_class", kind: "event_class", title: "How would you describe the event?", sub: "Different rooms, different logistics — we'll tailor accordingly." });
    qs.push({ id: "crowd", kind: "number", title: "How big is the crowd?", sub: "A rough number is all we need. No pressure to be exact.", field: "crowd_size", placeholder: "e.g. 300", optional: true });
    qs.push({ id: "ticket", kind: "number", title: "Ticket price? (M)", sub: "Skip it if it's a private jol — nothing on sale.", field: "ticket_price", placeholder: "0 = free / private", optional: true });
    qs.push({ id: "checks", kind: "checks", title: "Quick tick-box round", sub: "Each yes sharpens your quote and speeds up approval." });
    qs.push({ id: "proof", kind: "text", title: "Got an event page or poster?", sub: "Instant trust boost — a link means we can green-light faster.", field: "proof_link", placeholder: "https://…", optional: true });
    qs.push({ id: "contact_name", kind: "text", title: "Who's booking? Your name", sub: "So we know what to call you — nothing formal.", field: "contact_name", placeholder: "Full name", required: true });
    qs.push({ id: "contact_email", kind: "text", title: "Best email?", sub: "The quote and contract land here.", field: "contact_email", placeholder: "you@email.com", inputType: "email", required: true });
    qs.push({ id: "contact_phone", kind: "text", title: "Phone number?", sub: "Optional. Handy if WhatsApp's playing up.", field: "contact_phone", placeholder: "+266 …", inputType: "tel", optional: true });
    qs.push({ id: "contact_whatsapp", kind: "text", title: "WhatsApp?", sub: "This is where most of the magic happens.", field: "contact_whatsapp", placeholder: "+266 …", inputType: "tel", optional: true });
    qs.push({ id: "pref", kind: "preferred_contact", title: "Best ways to reach you?", sub: "Tap all that work — WhatsApp, email, call, or all three." });
    qs.push({ id: "notes", kind: "textarea", title: "Anything else we should know?", sub: "Stage plot, dress code, wild dreams — all welcome. Optional.", field: "description", optional: true });
    qs.push({ id: "review", kind: "review", title: "Sharp — let's double-check", sub: "One last read before we buzz the team. Nothing's locked yet." });
    return qs;
  }, [f.artist_id]);

  const total = questions.length;
  const current = questions[Math.min(q, total - 1)];

  function go(delta: 1 | -1) {
    setDir(delta);
    setQ((n) => Math.max(0, Math.min(total - 1, n + delta)));
  }

  function validateCurrent(): string | null {
    if (!current) return null;
    switch (current.kind) {
      case "artist": if (!f.artist_id) return "Pick an artist to get started.";
        return null;
      case "package": if (!f.package_id) return "Choose a package — it's just a starting point.";
        return null;
      case "event_type": if (!f.event_type) return "Give us the vibe — one tap.";
        return null;
      case "country": if (!f.country) return "Choose a country.";
        return null;
      case "city": if (!f.city.trim() || f.city === "__other__") return "Pick or type a city.";
        return null;
      case "date": {
        if (!f.event_date) return "Pick a date.";
        const d = new Date(f.event_date);
        if (isNaN(d.getTime()) || d.getTime() < Date.now() - 86_400_000) return "That date's in the past — pick one ahead.";
        return null;
      }
      case "preferred_contact":
        if (!f.contact_channels.length) return "Pick at least one way we can reach you.";
        return null;
      case "text":
      case "number": {
        const val = String(f[current.field] ?? "").trim();
        if (current.required && !val) return "This one's needed to move on.";
        if (current.field === "contact_email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "That email looks off — double-check?";
        return null;
      }
      default: return null;
    }
  }

  function next() {
    const err = validateCurrent();
    if (err) { toast.error(err); return; }
    if (q === total - 1) { submit(); return; }
    go(1);
  }

  function pickAndAdvance<K extends keyof Form>(k: K, v: Form[K]) {
    set(k, v);
    window.setTimeout(() => go(1), 260);
  }

  function toggleChannel(ch: ContactChannel) {
    setF((x) => {
      const has = x.contact_channels.includes(ch);
      const next = has ? x.contact_channels.filter((c) => c !== ch) : [...x.contact_channels, ch];
      // Keep at least one; primary = first in the chosen list
      const finalList = next.length ? next : [ch];
      return { ...x, contact_channels: finalList, preferred_contact: finalList[0] };
    });
  }

  function buildPayload() {
    // Encode multi-channel preference: primary + extras noted in description
    const primary = f.contact_channels[0] ?? f.preferred_contact;
    const extras = f.contact_channels.filter((c) => c !== primary);
    const extraNote = extras.length ? `Also reachable via: ${extras.join(", ")}.` : "";
    const description = [f.description.trim(), extraNote].filter(Boolean).join("\n\n");
    return {
      artist_id: f.artist_id,
      package_id: f.package_id,
      event_type: f.event_type,
      event_name: f.event_name.trim(),
      venue: f.venue.trim() || null,
      city: f.city.trim(),
      country: f.country.trim(),
      event_date: f.event_date,
      start_time: f.start_time || null,
      end_time: f.end_time || null,
      ends_after_10pm: f.ends_after_10pm,
      crowd_size: f.crowd_size ? parseInt(f.crowd_size, 10) : null,
      ticket_price: f.ticket_price ? parseInt(f.ticket_price, 10) : null,
      has_sponsors: f.has_sponsors,
      has_media: f.has_media,
      event_class: f.event_class,
      client_offer: f.client_offer ? parseInt(f.client_offer, 10) : null,
      budget_min: f.budget_min ? parseInt(f.budget_min, 10) : null,
      deposit_ready: f.deposit_ready,
      proof_link: f.proof_link.trim() || null,
      contact_name: f.contact_name.trim(),
      contact_email: f.contact_email.trim(),
      contact_phone: f.contact_phone.trim() || null,
      contact_whatsapp: f.contact_whatsapp.trim() || null,
      contact_company: f.contact_company.trim() || null,
      preferred_contact: primary,
      description: description || null,
    };
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Submission failed");
      try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      navigate({ to: "/book/confirm/$ref" as never, params: { ref: j.ref } as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally { setBusy(false); }
  }

  function downloadDraftQuote() {
    try {
      downloadIndicativeQuote(f, artist, pkg, distance);
      toast.success("Draft quote downloaded — save it for your records.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build PDF");
    }
  }

  // Enter-to-advance
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement;
      if (t && t.tagName === "TEXTAREA") return;
      e.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, f]);

  const progress = ((q + 1) / total) * 100;

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none"><CinematicBackdrop variant="ambient" /></div>
      <GrainOverlay />
      <header className="sticky top-0 z-30 border-b border-primary/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2"><LogoLockup /></Link>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {savedFlash && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-primary/80"
                >
                  <Check className="h-3 w-3" /> Saved
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Step {q + 1} / {total}
            </span>
          </div>
        </div>
        <div className="relative h-[3px] w-full overflow-hidden bg-primary/10">
          <motion.div
            className="h-full bg-gradient-to-r from-primary/70 via-primary to-goldleaf"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
          />
        </div>
      </header>

      <main ref={containerRef} className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <Card ref={cardRef} className="relative overflow-hidden border-primary/15 bg-card/60 p-6 sm:p-10 shadow-quote min-h-[420px]">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={current?.id ?? q}
              custom={dir}
              initial={{ opacity: 0, x: dir * 48, filter: "blur(6px)" }}
              animate={{
                opacity: 1,
                x: 0,
                filter: "blur(0px)",
                transition: {
                  duration: 0.55,
                  ease: [0.16, 1, 0.3, 1],
                  when: "beforeChildren",
                  staggerChildren: 0.06,
                  delayChildren: 0.04,
                },
              }}
              exit={{
                opacity: 0,
                x: -dir * 48,
                filter: "blur(6px)",
                transition: { duration: 0.28, ease: [0.7, 0, 0.84, 0] },
              }}
              className="space-y-6"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
                }}
                initial="hidden"
                animate="visible"
              >
                <div className="text-[10px] uppercase tracking-[0.28em] text-primary mb-2">
                  Question {q + 1}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
                  {current?.title}
                </h2>
                {current?.sub && (
                  <p className="mt-2 text-sm text-muted-foreground">{current.sub}</p>
                )}
              </motion.div>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
                }}
                initial="hidden"
                animate="visible"
              >
                <QuestionBody
                  q={current}
                  f={f}
                  set={set}
                  pickAndAdvance={pickAndAdvance}
                  toggleChannel={toggleChannel}
                  artists={artists}
                  packagesFor={packagesFor}
                  artist={artist}
                  pkg={pkg}
                  distance={distance}
                  distanceLoading={distanceLoading}
                  onDownloadQuote={downloadDraftQuote}
                  onSubmit={submit}
                  busy={busy}
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>


          <div className="mt-10 flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => go(-1)} disabled={q === 0 || busy}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            <div className="flex items-center gap-3">
              {current?.kind === "text" || current?.kind === "number" || current?.kind === "textarea" ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  press <kbd className="rounded border border-border/60 bg-background/70 px-1.5 py-0.5">Enter</kbd> <CornerDownLeft className="h-3 w-3" />
                </span>
              ) : null}

              {current?.optional && q < total - 1 && (
                <Button type="button" variant="ghost" onClick={() => go(1)} disabled={busy}>
                  Skip for now
                </Button>
              )}
              {q < total - 1 ? (
                <Button type="button" onClick={next} disabled={busy} className="min-w-[110px]">
                  OK <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button type="button" onClick={submit} disabled={busy} className="min-w-[140px]">
                  {busy ? "Sending…" : "Send it"} <Check className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <button
            type="button"
            onClick={resetDraft}
            className="inline-flex items-center gap-1 hover:text-primary transition"
            title="Clear your saved draft"
          >
            <RotateCcw className="h-3 w-3" /> Start over
          </button>
          <span className="hidden sm:inline">Auto-saved as you go · No deposit until you confirm</span>
          <span className="sm:hidden">Auto-saved · No deposit yet</span>
        </div>
      </main>
    </div>
  );
}

// ------- Question definitions -------
type TextField = "event_name" | "venue" | "proof_link" | "contact_name" | "contact_email" | "contact_phone" | "contact_whatsapp" | "description";
type NumberField = "crowd_size" | "ticket_price";

type Question =
  | { id: string; kind: "artist"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "package"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "event_type"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "country"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "city"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "date"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "time"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "event_class"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "checks"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "preferred_contact"; title: string; sub?: string; optional?: boolean }
  | { id: string; kind: "text"; title: string; sub?: string; field: TextField; placeholder?: string; inputType?: string; required?: boolean; optional?: boolean }
  | { id: string; kind: "number"; title: string; sub?: string; field: NumberField; placeholder?: string; required?: boolean; optional?: boolean }
  | { id: string; kind: "textarea"; title: string; sub?: string; field: TextField; optional?: boolean }
  | { id: string; kind: "review"; title: string; sub?: string; optional?: boolean };

interface BodyProps {
  q?: Question;
  f: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  pickAndAdvance: <K extends keyof Form>(k: K, v: Form[K]) => void;
  toggleChannel: (ch: ContactChannel) => void;
  artists: Artist[];
  packagesFor: (aid: string) => Pkg[];
  artist?: Artist;
  pkg?: Pkg;
  distance: { km: number; minutes: number; overnight: boolean; destination: string } | null;
  distanceLoading: boolean;
  onDownloadQuote: () => void;
  onSubmit: () => void;
  busy: boolean;
}

function QuestionBody({ q, f, set, pickAndAdvance, toggleChannel, artists, packagesFor, artist, pkg, distance, distanceLoading, onDownloadQuote, onSubmit, busy }: BodyProps) {
  const autoFocusRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => { autoFocusRef.current?.focus(); }, [q?.id]);
  if (!q) return null;

  switch (q.kind) {
    case "artist":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {artists.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => pickAndAdvance("artist_id", a.id)}
              className={cn(
                "text-left rounded-xl border p-4 transition hover:-translate-y-0.5",
                f.artist_id === a.id ? "border-primary bg-primary/10 shadow-[0_0_30px_-12px] shadow-primary/60" : "border-border hover:border-primary/50",
              )}
            >
              <div className="mb-3 flex justify-center">
                <div className="relative h-16 w-16 rotate-45 overflow-hidden rounded-md border border-primary/40 bg-primary/10">
                  {a.photo && /^(https?:|\/)/.test(a.photo) ? (
                    <img src={a.photo} alt={a.name} className="absolute inset-0 h-full w-full -rotate-45 scale-150 object-cover" />
                  ) : (
                    <div className="absolute inset-0 -rotate-45 flex items-center justify-center text-lg font-display text-primary">
                      {a.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 font-semibold">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.tagline}</div>
            </button>
          ))}
        </div>
      );

    case "package":
      return (
        <div className="grid gap-2">
          {artist && packagesFor(artist.id).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickAndAdvance("package_id", p.id)}
              className={cn(
                "text-left rounded-xl border p-4 transition hover:-translate-y-0.5",
                f.package_id === p.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium">{p.name}</div>
                <div className="text-primary font-mono">from M {p.base_price.toLocaleString()}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
            </button>
          ))}
        </div>
      );

    case "event_type":
      return (
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => pickAndAdvance("event_type", t.v)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition",
                f.event_type === t.v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              <span className="mr-1.5">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      );

    case "country":
      return (
        <Select
          value={f.country}
          onValueChange={(v) => { set("country", v); set("city", ""); }}
        >
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Choose a country" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectGroup>
              <SelectLabel>SADC</SelectLabel>
              {SADC_COUNTRIES.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Rest of Africa</SelectLabel>
              {OTHER_AFRICA.map((c) => (<SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>))}
            </SelectGroup>
          </SelectContent>
        </Select>
      );

    case "city": {
      const cities = citiesFor(f.country);
      return (
        <div className="space-y-3">
          {cities.length > 0 ? (
            <Select value={f.city && f.city !== "__other__" ? f.city : ""} onValueChange={(v) => v === "__other__" ? set("city", "__other__") : pickAndAdvance("city", v)}>
              <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Choose a city" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                <SelectItem value="__other__">Other / not listed…</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input autoFocus className="h-12 text-base" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder={f.country ? "Type city name" : "Pick a country first"} disabled={!f.country} />
          )}
          {f.city === "__other__" && (
            <Input autoFocus className="h-12 text-base" placeholder="Type city name" onChange={(e) => set("city", e.target.value)} />
          )}
          {(distanceLoading || distance) && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm">
              {distanceLoading && (
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 animate-pulse" />Working out the drive…</div>
              )}
              {distance && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <div><div className="font-medium">{distance.km.toLocaleString()} km · ~{Math.floor(distance.minutes / 60)}h {distance.minutes % 60}m drive</div></div>
                  </div>
                  {distance.overnight && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200 text-xs">
                      <BedDouble className="mt-0.5 h-3.5 w-3.5" /> Overnight recommended — we'll include accommodation.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    case "date":
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={cn("h-12 w-full justify-start text-left text-base font-normal", !f.event_date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {f.event_date ? format(parseISO(f.event_date), "EEEE, d MMM yyyy") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={f.event_date ? parseISO(f.event_date) : undefined}
              onSelect={(d) => { if (d) pickAndAdvance("event_date", format(d, "yyyy-MM-dd")); }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      );

    case "time":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Start</div>
            <Input type="time" className="h-12 text-base" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">End</div>
            <Input type="time" className="h-12 text-base" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <Checkbox checked={f.ends_after_10pm} onCheckedChange={(v) => set("ends_after_10pm", !!v)} />
            Ends after 10pm (may need overnight)
          </label>
        </div>
      );

    case "event_class":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {EVENT_CLASSES.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => pickAndAdvance("event_class", c.v)}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                f.event_class === c.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              <div className="font-semibold">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </button>
          ))}
        </div>
      );

    case "checks":
      return (
        <div className="space-y-3">
          {[
            { key: "deposit_ready" as const, label: "I can drop the 50% deposit within 48hrs of accepting the quote.", emoji: "💰" },
            { key: "has_sponsors" as const, label: "Sponsors on board (alcohol brand, telco, corporate).", emoji: "🤝" },
            { key: "has_media" as const, label: "Media / TV / streaming coverage confirmed.", emoji: "📺" },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => set(c.key, !f[c.key])}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                f[c.key] ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              )}
            >
              <span className="text-lg">{c.emoji}</span>
              <span className="flex-1 text-sm">{c.label}</span>
              <span className={cn("mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border", f[c.key] ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {f[c.key] && <Check className="h-3 w-3" />}
              </span>
            </button>
          ))}
        </div>
      );

    case "preferred_contact": {
      const primary = f.contact_channels[0];
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {CONTACT_PREF.map((c) => {
              const on = f.contact_channels.includes(c.v);
              const isPrimary = primary === c.v;
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => toggleChannel(c.v)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border p-5 transition text-center",
                    on ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                  )}
                >
                  <span className="absolute right-2 top-2">
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {on && <Check className="h-2.5 w-2.5" />}
                    </span>
                  </span>
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.sub}</span>
                  {isPrimary && f.contact_channels.length > 1 && (
                    <span className="mt-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">Primary</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Tick as many as you like — we'll try the first one first, then fall back to the others if we can't reach you.
          </p>
        </div>
      );
    }

    case "text":
      return (
        <Input
          ref={(el) => { autoFocusRef.current = el; }}
          autoFocus
          className="h-14 text-lg"
          type={q.inputType ?? "text"}
          value={String(f[q.field] ?? "")}
          onChange={(e) => set(q.field, e.target.value as Form[typeof q.field])}
          placeholder={q.placeholder}
        />
      );

    case "number":
      return (
        <Input
          ref={(el) => { autoFocusRef.current = el; }}
          autoFocus
          className="h-14 text-lg"
          type="number"
          min={0}
          value={String(f[q.field] ?? "")}
          onChange={(e) => set(q.field, e.target.value as Form[typeof q.field])}
          placeholder={q.placeholder}
        />
      );

    case "textarea":
      return (
        <Textarea
          ref={(el) => { autoFocusRef.current = el; }}
          autoFocus
          rows={5}
          className="text-base"
          value={String(f[q.field] ?? "")}
          onChange={(e) => set(q.field, e.target.value as Form[typeof q.field])}
          placeholder="Tell us anything…"
        />
      );

    case "review":
      return (
        <div className="space-y-2 text-sm">
          <Row label="Artist" value={artist?.name} />
          <Row label="Package" value={pkg?.name} />
          <Row label="Event" value={`${f.event_type} · ${f.event_name}`} />
          <Row label="Where" value={`${f.venue ? f.venue + ", " : ""}${f.city}, ${f.country}`} />
          <Row label="Date" value={f.event_date ? format(parseISO(f.event_date), "EEE, d MMM yyyy") : "—"} />
          <Row label="Time" value={[f.start_time, f.end_time].filter(Boolean).join(" – ") || "—"} />
          <Row label="Crowd" value={f.crowd_size ? `${f.crowd_size} pax` : "—"} />
          <Row label="Ticket" value={f.ticket_price ? `M ${Number(f.ticket_price).toLocaleString()}` : "—"} />
          <Row label="Deposit-ready" value={f.deposit_ready ? "Yebo" : "Not yet"} />
          <Row label="Reach me on" value={f.contact_channels.map((c) => c === "whatsapp" ? "WhatsApp" : c === "email" ? "Email" : "Phone").join(", ")} />
          <Row label="Contact" value={`${f.contact_name} · ${f.contact_email}`} />

          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            Hit <strong>Send it</strong> and our booking manager buzzes back sharp sharp — usually within a few hours. Want the numbers on paper first? Grab an indicative quote below.
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onDownloadQuote} disabled={!pkg}>
              <FileDown className="h-4 w-4 mr-1.5" /> Download indicative quote
            </Button>
            <Button type="button" onClick={onSubmit} disabled={busy}>
              <Sparkles className="h-4 w-4 mr-1.5" /> {busy ? "Sending…" : "Send it & get final quote"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The downloaded quote is a working estimate based on package pricing and estimated travel — the manager confirms the final figure.
          </p>
        </div>
      );
  }
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

// -------------- Indicative quote PDF (lightweight, no server) --------------
function downloadIndicativeQuote(
  f: Form,
  artist: Artist | undefined,
  pkg: Pkg | undefined,
  distance: { km: number; minutes: number; overnight: boolean } | null,
) {
  if (!pkg) throw new Error("Pick a package to generate a quote.");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const GOLD: [number, number, number] = [212, 175, 85];
  const INK: [number, number, number] = [22, 22, 28];
  const MUTED: [number, number, number] = [110, 110, 118];

  // Travel estimate — rough (M 25/km round-trip) — final figure comes from the manager
  const km = distance?.km ?? 0;
  const travel = Math.round(km * 2 * 25);
  const overnight = distance?.overnight ? Math.max(0, Math.round(pkg.crew_size * 1200)) : 0;
  const eventClassMult: Record<Form["event_class"], number> = { private: 1, corporate: 1.25, festival: 1.4, televised: 1.6 };
  const performance = Math.round(pkg.base_price * eventClassMult[f.event_class]);
  const subtotal = performance + travel + overnight;
  const commission = Math.round(performance * 0.1);
  const total = subtotal + commission;
  const deposit = Math.round(total / 2);
  const balance = total - deposit;
  const money = (n: number) => `M ${n.toLocaleString()}`;
  const ref = `PP-DRAFT-${(f.event_date || "").replace(/-/g, "").slice(0, 8) || "TBD"}`;

  // Header band
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(...GOLD);
  doc.rect(M, 28, 34, 34, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("P", M + 11, 52);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("PENYAPLAY · INDICATIVE QUOTE", M + 46, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 205);
  doc.text("Working estimate — final figure confirmed by your booking manager.", M + 46, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(`REF · ${ref}`, W - M, 46, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 205);
  doc.text(new Date().toISOString().slice(0, 10), W - M, 60, { align: "right" });

  y = 120;
  doc.setTextColor(...INK);

  // Event block
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(f.event_name || "Untitled event", M, y);
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${f.event_type || "—"}  ·  ${f.city || "—"}, ${f.country || "—"}  ·  ${f.event_date || "date TBD"}`, M, y);
  y += 12;
  doc.text(`Artist: ${artist?.name ?? "—"}  ·  Package: ${pkg.name} (crew ${pkg.crew_size}${pkg.duration_minutes ? ` · ${pkg.duration_minutes} min` : ""})`, M, y);
  y += 22;

  // Total banner
  doc.setFillColor(248, 250, 240);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.roundedRect(M, y, W - 2 * M, 68, 8, 8, "FD");
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("INDICATIVE TOTAL", M + 16, y + 20);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24);
  doc.text(money(total), M + 16, y + 48);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (distance) {
    doc.text(`${km.toLocaleString()} km · ~${Math.floor(distance.minutes / 60)}h ${distance.minutes % 60}m drive`, W - M - 16, y + 26, { align: "right" });
  }
  doc.text(`50% deposit ${money(deposit)} · Balance ${money(balance)}`, W - M - 16, y + 40, { align: "right" });
  y += 88;

  // Line items
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Line items", M, y); y += 14;
  const lines: [string, number][] = [
    [`Performance fee (${pkg.name}, ${f.event_class})`, performance],
    ...(travel ? [[`Estimated travel (${km} km × 2 × M25)`, travel] as [string, number]] : []),
    ...(overnight ? [[`Overnight for crew of ${pkg.crew_size}`, overnight] as [string, number]] : []),
    ["Platform commission (10%)", commission],
  ];
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  for (const [label, amt] of lines) {
    doc.text(label, M, y);
    doc.text(money(amt), W - M, y, { align: "right" });
    y += 14;
  }
  y += 8;
  doc.setDrawColor(220, 220, 224); doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y); y += 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Indicative total", M, y);
  doc.text(money(total), W - M, y, { align: "right" });
  y += 26;

  // Fine print
  doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  const fine = doc.splitTextToSize(
    "This is an indicative estimate generated from your booking answers. Final pricing depends on venue tech spec, exact travel routing, hospitality, and any promo/sponsor obligations. Your Penya Play manager confirms the binding figure once the booking is reviewed.",
    W - 2 * M,
  );
  doc.text(fine, M, y);

  // Footer
  doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text(`PENYAPLAY · ${ref} · not a binding quote`, M, H - 20);
  doc.text("penyaplay.co", W - M, H - 20, { align: "right" });

  doc.save(`${ref}.pdf`);
}
