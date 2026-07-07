import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo-mark";
import { GrainOverlay } from "@/components/brand/grain";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Request a booking — Penya Play" },
      { name: "description", content: "Request a booking for Ntate Stunna or another Penya Play artist." },
    ],
  }),
  component: BookingForm,
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

const EVENT_TYPES = ["Wedding", "Private party", "Corporate", "Festival", "Church event", "Concert", "Product launch", "Other"];

function BookingForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
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

  // Auto-select single artist
  useEffect(() => {
    if (!f.artist_id && artists.length === 1) setF((x) => ({ ...x, artist_id: artists[0].id }));
  }, [artists, f.artist_id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const steps = ["Artist & package", "Event", "Logistics & budget", "Contact", "Review"];

  function validateStep(): string | null {
    if (step === 0) {
      if (!f.artist_id) return "Choose an artist";
      if (!f.package_id) return "Choose a package";
    }
    if (step === 1) {
      if (!f.event_type) return "Event type required";
      if (!f.event_name.trim()) return "Event name required";
      if (!f.city.trim()) return "City required";
      if (!f.event_date) return "Event date required";
      const d = new Date(f.event_date);
      if (isNaN(d.getTime())) return "Invalid date";
      if (d.getTime() < Date.now() - 86_400_000) return "Event date must be in the future";
    }
    if (step === 2) {
      if (!f.client_offer && !f.budget_min) return "Enter an offer or a minimum budget";
    }
    if (step === 3) {
      if (!f.contact_name.trim()) return "Full name required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email)) return "Valid email required";
    }
    return null;
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
    } finally {
      setBusy(false);
    }
  }

  const artist = artists.find((a) => a.id === f.artist_id);
  const pkg = (data?.packages ?? []).find((p) => p.id === f.package_id);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GrainOverlay />
      <header className="sticky top-0 z-30 border-b border-primary/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <LogoLockup />
          </Link>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Step {step + 1} / {steps.length}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pt-6">
        {/* Gold liquid progress bar */}
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-primary/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-primary/80"
            initial={false}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-primary">{steps[step]}</div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card className="border-primary/15 bg-card/60 p-6 shadow-quote">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >

          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display mb-1">Choose your artist</h2>
                <p className="text-sm text-muted-foreground">All artists listed are available for private, corporate and festival bookings.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {artists.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => set("artist_id", a.id)}
                    className={`text-left rounded-lg border p-4 transition ${
                      f.artist_id === a.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-2xl text-primary">{a.photo ?? "◆"}</div>
                    <div className="mt-2 font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.tagline}</div>
                  </button>
                ))}
              </div>

              {artist && (
                <div>
                  <h3 className="text-lg font-display mb-3">Pick a package</h3>
                  <div className="grid gap-2">
                    {packagesFor(artist.id).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => set("package_id", p.id)}
                        className={`text-left rounded-lg border p-4 transition ${
                          f.package_id === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-primary font-mono">from M {p.base_price.toLocaleString()}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    The package price is a baseline. Travel, accommodation and event class adjust the final quote.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-display mb-1">The event</h2>

              <div>
                <Label>Event type</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("event_type", t)}
                      className={`rounded-full px-3 py-1 text-sm border ${
                        f.event_type === t ? "bg-primary text-primary-foreground border-primary" : "border-border"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Event name</Label>
                  <Input value={f.event_name} onChange={(e) => set("event_name", e.target.value)} placeholder="e.g. Nkopane's 40th" />
                </div>
                <div>
                  <Label>Venue</Label>
                  <Input value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Venue name" />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Maseru" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={f.country} onChange={(e) => set("country", e.target.value)} />
                </div>
                <div>
                  <Label>Event date *</Label>
                  <Input type="date" value={f.event_date} onChange={(e) => set("event_date", e.target.value)} />
                </div>
                <div>
                  <Label>Event class</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={f.event_class}
                    onChange={(e) => set("event_class", e.target.value as Form["event_class"])}
                  >
                    <option value="private">Private</option>
                    <option value="corporate">Corporate</option>
                    <option value="festival">Festival</option>
                    <option value="televised">Televised / broadcast</option>
                  </select>
                </div>
                <div>
                  <Label>Start time</Label>
                  <Input type="time" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} />
                </div>
                <div>
                  <Label>End time</Label>
                  <Input type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.ends_after_10pm} onCheckedChange={(v) => set("ends_after_10pm", !!v)} />
                Event ends after 10pm (may require overnight)
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-display mb-1">Logistics & budget</h2>
              <p className="text-xs text-muted-foreground">
                Serious bookings only — accurate answers get you a faster, more accurate quote.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Expected crowd size</Label>
                  <Input type="number" min={0} value={f.crowd_size} onChange={(e) => set("crowd_size", e.target.value)} />
                </div>
                <div>
                  <Label>Ticket price (M, if ticketed)</Label>
                  <Input type="number" min={0} value={f.ticket_price} onChange={(e) => set("ticket_price", e.target.value)} />
                </div>
                <div>
                  <Label>Your offer (M)</Label>
                  <Input type="number" min={0} value={f.client_offer} onChange={(e) => set("client_offer", e.target.value)} placeholder="Your all-in offer" />
                </div>
                <div>
                  <Label>Minimum budget (M)</Label>
                  <Input type="number" min={0} value={f.budget_min} onChange={(e) => set("budget_min", e.target.value)} placeholder="Or a range floor" />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-primary/15 bg-primary/5 p-4">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={f.deposit_ready} onCheckedChange={(v) => set("deposit_ready", !!v)} className="mt-0.5" />
                  <span>
                    <strong>Deposit-ready:</strong> I can pay the 50% deposit within 48 hours of accepting the quote.
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={f.has_sponsors} onCheckedChange={(v) => set("has_sponsors", !!v)} className="mt-0.5" />
                  <span>Sponsors attached (alcohol brand, telco, corporate)</span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={f.has_media} onCheckedChange={(v) => set("has_media", !!v)} className="mt-0.5" />
                  <span>Media / TV / streaming coverage confirmed</span>
                </label>
              </div>

              <div>
                <Label>Event page or social link</Label>
                <Input value={f.proof_link} onChange={(e) => set("proof_link", e.target.value)} placeholder="https://…" />
                <p className="mt-1 text-xs text-muted-foreground">Poster, event page, or organiser social profile — helps us verify.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-display mb-1">Your details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Full name *</Label>
                  <Input value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
                </div>
                <div>
                  <Label>Company / organisation</Label>
                  <Input value={f.contact_company} onChange={(e) => set("contact_company", e.target.value)} />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={f.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input type="tel" value={f.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <Input type="tel" value={f.contact_whatsapp} onChange={(e) => set("contact_whatsapp", e.target.value)} placeholder="+266 …" />
                </div>
                <div>
                  <Label>Preferred contact</Label>
                  <RadioGroup value={f.preferred_contact} onValueChange={(v) => set("preferred_contact", v as Form["preferred_contact"])} className="mt-2 flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="whatsapp" /> WhatsApp</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="email" /> Email</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="phone" /> Phone</label>
                  </RadioGroup>
                </div>
              </div>
              <div>
                <Label>Anything else we should know?</Label>
                <Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-display">Review & submit</h2>
              <div className="space-y-2 text-sm">
                <Row label="Artist" value={artist?.name} />
                <Row label="Package" value={pkg?.name} />
                <Row label="Event" value={`${f.event_type} · ${f.event_name}`} />
                <Row label="Where / when" value={`${f.venue ? f.venue + ", " : ""}${f.city}, ${f.country} · ${f.event_date}`} />
                <Row label="Crowd" value={f.crowd_size ? `${f.crowd_size} pax` : "—"} />
                <Row label="Offer" value={f.client_offer ? `M ${Number(f.client_offer).toLocaleString()}` : (f.budget_min ? `Min M ${Number(f.budget_min).toLocaleString()}` : "—")} />
                <Row label="Deposit-ready" value={f.deposit_ready ? "Yes" : "No"} />
                <Row label="Contact" value={`${f.contact_name} · ${f.contact_email}`} />
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                By submitting you agree that <strong>the date is not confirmed</strong> until the deposit is verified.
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                type="button"
                onClick={() => {
                  const err = validateStep();
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  setStep((s) => s + 1);
                }}
              >
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={busy}>
                {busy ? "Submitting…" : "Submit request"} <Check className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}
