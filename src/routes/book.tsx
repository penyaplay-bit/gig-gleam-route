// Mzansi-warm, one-question-at-a-time booking flow.
// Every field is its own screen with a slide transition. Enter to continue.
// Optional questions can be skipped. Chip/date/artist choices auto-advance
// so it feels like a chat, not a form.
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
import { ArrowLeft, ArrowRight, Check, CalendarIcon, CornerDownLeft, BedDouble, MapPin } from "lucide-react";
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

export const Route = createFileRoute("/book")({
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
  preferred_contact: "whatsapp" | "email" | "phone";
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

const CONTACT_PREF = [
  { v: "whatsapp", label: "WhatsApp", emoji: "💬" },
  { v: "email", label: "Email", emoji: "📧" },
  { v: "phone", label: "Phone call", emoji: "📞" },
] as const;

function BookingFlow() {
  const navigate = useNavigate();
  const [q, setQ] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Form>({
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
    preferred_contact: "whatsapp",
    description: "",
  });

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

  // Auto-select if only one artist
  useEffect(() => {
    if (!f.artist_id && artists.length === 1) setF((x) => ({ ...x, artist_id: artists[0].id }));
  }, [artists, f.artist_id]);

  // Autofill from signed-in user
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

  // Build the ordered question list based on current state
  const questions = useMemo(() => {
    const qs: Question[] = [];
    qs.push({ id: "artist", kind: "artist", title: "Howzit 👋 who's headlining?", sub: "Pick who you want on stage." });
    if (f.artist_id) qs.push({ id: "package", kind: "package", title: "Choose your package", sub: "Baseline price — travel & class adjust the final quote." });
    qs.push({ id: "event_type", kind: "event_type", title: "What kind of vibe?", sub: "So we know who to send." });
    qs.push({ id: "event_name", kind: "text", title: "Give the event a name", sub: "Something you'll recognise — e.g. \"Nkopane's 40th\".", field: "event_name", placeholder: "Event name", required: true });
    qs.push({ id: "country", kind: "country", title: "Where's the gig?", sub: "Country first." });
    qs.push({ id: "city", kind: "city", title: "And which city?", sub: "Helps us work out travel." });
    qs.push({ id: "venue", kind: "text", title: "Venue name?", sub: "Optional — skip if not booked yet.", field: "venue", placeholder: "e.g. Maseru Sun", optional: true });
    qs.push({ id: "event_date", kind: "date", title: "When's the date?", sub: "Weekends book out fast, chief." });
    qs.push({ id: "time", kind: "time", title: "Roughly what time?", sub: "Optional. Helps us plan travel." });
    qs.push({ id: "event_class", kind: "event_class", title: "How would you describe the event?", sub: "Different vibes, different logistics." });
    qs.push({ id: "crowd", kind: "number", title: "How big is the crowd?", sub: "Rough number is fine.", field: "crowd_size", placeholder: "e.g. 300", optional: true });
    qs.push({ id: "ticket", kind: "number", title: "Ticket price? (M)", sub: "Skip if it's a private jol.", field: "ticket_price", placeholder: "0 = free / private", optional: true });
    qs.push({ id: "checks", kind: "checks", title: "Quick tick-box round", sub: "The more yeses, the sharper your quote." });
    qs.push({ id: "proof", kind: "text", title: "Got an event page or poster?", sub: "Optional — makes us trust the gig faster.", field: "proof_link", placeholder: "https://…", optional: true });
    qs.push({ id: "contact_name", kind: "text", title: "Who's booking? Your name", sub: "So we know what to call you.", field: "contact_name", placeholder: "Full name", required: true });
    qs.push({ id: "contact_email", kind: "text", title: "Best email?", sub: "For the quote & contract.", field: "contact_email", placeholder: "you@email.com", inputType: "email", required: true });
    qs.push({ id: "contact_phone", kind: "text", title: "Phone number?", sub: "Optional. Keeps things moving.", field: "contact_phone", placeholder: "+266 …", inputType: "tel", optional: true });
    qs.push({ id: "contact_whatsapp", kind: "text", title: "WhatsApp?", sub: "We drop most updates here.", field: "contact_whatsapp", placeholder: "+266 …", inputType: "tel", optional: true });
    qs.push({ id: "pref", kind: "preferred_contact", title: "Best way to reach you?", sub: "We'll respect it." });
    qs.push({ id: "notes", kind: "textarea", title: "Anything else we should know?", sub: "Stage plot, dress code, wild ideas. Optional.", field: "description", optional: true });
    qs.push({ id: "review", kind: "review", title: "Sharp — review & send", sub: "One last look before we buzz the team." });
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
      case "artist": if (!f.artist_id) return "Pick an artist first.";
        return null;
      case "package": if (!f.package_id) return "Pick a package.";
        return null;
      case "event_type": if (!f.event_type) return "Tell us the vibe.";
        return null;
      case "country": if (!f.country) return "Choose a country.";
        return null;
      case "city": if (!f.city.trim() || f.city === "__other__") return "Choose a city.";
        return null;
      case "date": {
        if (!f.event_date) return "Pick a date.";
        const d = new Date(f.event_date);
        if (isNaN(d.getTime()) || d.getTime() < Date.now() - 86_400_000) return "Date must be in the future.";
        return null;
      }
      case "text":
      case "number": {
        const val = String(f[current.field] ?? "").trim();
        if (current.required && !val) return "This one's needed, chief.";
        if (current.field === "contact_email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "That email looks off.";
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

  // Auto-advance a hair after a chip/artist/package/date pick
  function pickAndAdvance<K extends keyof Form>(k: K, v: Form[K]) {
    set(k, v);
    window.setTimeout(() => go(1), 260);
  }

  async function submit() {
    setBusy(true);
    try {
      const payload = {
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
        preferred_contact: f.preferred_contact,
        description: f.description.trim() || null,
      };
      const r = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Submission failed");
      navigate({ to: "/book/confirm/$ref" as never, params: { ref: j.ref } as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally { setBusy(false); }
  }

  // Enter-to-advance
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement;
      if (t && t.tagName === "TEXTAREA") return; // textarea keeps Enter for newline
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
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Step {q + 1} / {total}
          </span>
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
        <Card className="relative overflow-hidden border-primary/15 bg-card/60 p-6 sm:p-10 shadow-quote min-h-[420px]">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={current?.id ?? q}
              custom={dir}
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dir * 60 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              <div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-primary mb-2">
                  Question {q + 1}
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
                  {current?.title}
                </h2>
                {current?.sub && (
                  <p className="mt-2 text-sm text-muted-foreground">{current.sub}</p>
                )}
              </div>

              <QuestionBody
                q={current}
                f={f}
                set={set}
                pickAndAdvance={pickAndAdvance}
                artists={artists}
                packagesFor={packagesFor}
                artist={artist}
                pkg={pkg}
                distance={distance}
                distanceLoading={distanceLoading}
              />
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
                  Skip
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

        <p className="mt-4 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          No deposit yet · Cancel any time before you confirm · Ubuntu vibes only
        </p>
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
  artists: Artist[];
  packagesFor: (aid: string) => Pkg[];
  artist?: Artist;
  pkg?: Pkg;
  distance: { km: number; minutes: number; overnight: boolean; destination: string } | null;
  distanceLoading: boolean;
}

function QuestionBody({ q, f, set, pickAndAdvance, artists, packagesFor, artist, pkg, distance, distanceLoading }: BodyProps) {
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

    case "preferred_contact":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          {CONTACT_PREF.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => pickAndAdvance("preferred_contact", c.v)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-5 transition",
                f.preferred_contact === c.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              )}
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-sm font-medium">{c.label}</span>
            </button>
          ))}
        </div>
      );

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
          <Row label="Contact" value={`${f.contact_name} · ${f.contact_email}`} />
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            Hit <strong>Send it</strong> and we'll come back sharp sharp. The date isn't locked until the deposit lands.
          </div>
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
