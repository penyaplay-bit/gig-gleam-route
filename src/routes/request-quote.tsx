import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Ticket, CheckCircle2, AlertCircle, Sparkles, MapPin, Calendar, Users, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/pricing/artist-engine";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";

export const Route = createFileRoute("/request-quote")({
  head: () => ({
    meta: [
      { title: "Request a Quotation — PenyaPlay Booking" },
      {
        name: "description",
        content: "Book Ntate Stunna and other Penya Play artists. Submit your event brief, get a reviewed quotation from our team within 24 hours.",
      },
      { property: "og:title", content: "Request a Quotation — PenyaPlay" },
      { property: "og:description", content: "Book Ntate Stunna. Serious bookings only — reviewed by our team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RequestQuotePage,
});

const EVENT_TYPES = ["Festival", "Club", "Corporate", "Wedding", "Government", "Private", "Concert", "Church", "Community"];

type Artist = {
  id: string;
  name: string;
  currency: string;
  home_city: string | null;
  home_country_code: string | null;
  team_size: number;
  estimated_low: number;
  estimated_high: number;
};

type SuccessResp = {
  ok: true;
  ref: string;
  status: "under_review";
  estimated_range: { low: number; high: number; currency: string };
  message: string;
};


function RequestQuotePage() {
  const artistsQ = useQuery<{ artists: Artist[] }>({
    queryKey: ["public-artists"],
    queryFn: async () => {
      const r = await fetch("/api/public/quote-request", { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("Could not load artists");
      return r.json();
    },
  });
  const artists = artistsQ.data?.artists ?? [];

  const [artistId, setArtistId] = useState("");
  useEffect(() => {
    if (!artistId && artists.length) setArtistId(artists[0].id);
  }, [artists, artistId]);
  const artist = useMemo(() => artists.find((a) => a.id === artistId), [artists, artistId]);

  const [form, setForm] = useState({
    event_name: "",
    event_type: "Festival",
    event_date: "",
    venue: "",
    city: "",
    country: "South Africa",
    crowd_size: 500,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    contact_whatsapp: "",
    description: "",
  });
  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = useMutation<SuccessResp, Error>({
    mutationFn: async () => {
      const r = await fetch("/api/public/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist_profile_id: artistId, ...form }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Request failed");
      return json as SuccessResp;
    },
  });

  if (submit.data) return <SuccessTicket data={submit.data} artistName={artist?.name ?? ""} />;

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none"><CinematicBackdrop variant="ambient" /></div>
      {/* ===== Header band ===== */}
      <header className="border-b border-border/60 bg-card/40">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-primary">Penya Play Productions</div>
            <h1 className="font-display text-2xl mt-1">Book an Artist</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Reviewed quotations · No auto-pricing
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* ===== Ticket-style form ===== */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="rounded-xl border border-border/80 bg-card/40 overflow-hidden"
        >
          {/* Perforated top */}
          <div className="relative px-6 py-4 border-b border-dashed border-border/70 bg-primary/5">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-primary">Quotation Request</span>
            </div>
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/70" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/70" />
          </div>

          <div className="p-6 space-y-6">
            {/* Artist */}
            <Row icon={<Sparkles className="w-4 h-4" />} label="Artist">
              <Select value={artistId} onValueChange={setArtistId} disabled={artistsQ.isLoading}>
                <SelectTrigger><SelectValue placeholder={artistsQ.isLoading ? "Loading…" : "Select artist"} /></SelectTrigger>
                <SelectContent>
                  {artists.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {artist && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Based in {artist.home_city ?? "—"}{artist.home_country_code ? ` (${artist.home_country_code})` : ""} · touring party of {artist.team_size}
                </p>
              )}
            </Row>

            {/* Event */}
            <Row icon={<Calendar className="w-4 h-4" />} label="Event">
              <Input placeholder="Event name (e.g. Matjhabeng Fashion Week 2026)" value={form.event_name} onChange={(e) => update("event_name", e.target.value)} required maxLength={200} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Select value={form.event_type} onValueChange={(v) => update("event_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" value={form.event_date} onChange={(e) => update("event_date", e.target.value)} required min={new Date().toISOString().slice(0, 10)} />
              </div>
            </Row>

            {/* Location */}
            <Row icon={<MapPin className="w-4 h-4" />} label="Venue & location">
              <Input placeholder="Venue name" value={form.venue} onChange={(e) => update("venue", e.target.value)} required maxLength={200} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Input placeholder="City" value={form.city} onChange={(e) => update("city", e.target.value)} required maxLength={120} />
                <Input placeholder="Country" value={form.country} onChange={(e) => update("country", e.target.value)} required maxLength={80} />
              </div>
            </Row>

            {/* Crowd */}
            <Row icon={<Users className="w-4 h-4" />} label="Expected crowd">
              <Input type="number" min={10} max={500000} value={form.crowd_size} onChange={(e) => update("crowd_size", Number(e.target.value) || 0)} required />
              <p className="text-[11px] text-muted-foreground mt-1">Be honest — this drives production sizing and pricing tiers.</p>
            </Row>

            {/* Contact */}
            <Row icon={<Phone className="w-4 h-4" />} label="Your contact details">
              <Input placeholder="Full name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} required maxLength={120} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Input type="email" placeholder="Email" value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} required maxLength={200} />
                <Input type="tel" placeholder="Phone" value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} required maxLength={40} />
              </div>
              <Input className="mt-3" placeholder="WhatsApp (optional)" value={form.contact_whatsapp} onChange={(e) => update("contact_whatsapp", e.target.value)} maxLength={40} />
            </Row>

            {/* Notes */}
            <Row label="Anything else we should know?">
              <Textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Set list length, curfew, cross-promotion, sponsors, etc." maxLength={2000} />
            </Row>

            {submit.error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/5 text-sm text-red-300 p-3 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{submit.error.message}</span>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submit.isPending || !artistId}>
              {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit quotation request
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              You'll receive an estimated range immediately. Our team confirms the formal quotation, contract and rider within 24 hours.
            </p>
          </div>
        </form>

        {/* ===== Side stub ===== */}
        <aside className="lg:sticky lg:top-4 lg:self-start space-y-4">
          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-5">
            <div className="text-[10px] uppercase tracking-widest text-primary">Estimated Range</div>
            {artist ? (
              <>
                <div className="font-display text-2xl mt-2">
                  {formatCents(artist.estimated_low, artist.currency as any)}
                  <span className="text-muted-foreground text-base"> – </span>
                  {formatCents(artist.estimated_high, artist.currency as any)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  All-in envelope. Final quotation depends on distance, travel dates, crowd tier, production and rider.
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground mt-2">Select an artist to see an estimate.</div>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground text-sm">How this works</div>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Submit your brief.</li>
              <li>Get an estimated range now.</li>
              <li>We review your event and confirm a formal quotation with rider, contract and payment schedule.</li>
              <li>50% booking payment secures the date; 50% due 7 days before the event.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

function SuccessTicket({ data, artistName }: { data: SuccessResp; artistName: string }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 z-0 pointer-events-none"><CinematicBackdrop variant="ambient" /></div>
      <div className="max-w-md w-full rounded-xl border border-primary/40 bg-card/60 overflow-hidden">
        <div className="relative px-6 py-4 border-b border-dashed border-border/70 bg-primary/10">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-primary">Quotation Under Review</span>
          </div>
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/70" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border/70" />
        </div>
        <div className="p-6 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Reference</div>
            <div className="font-mono text-xl text-primary">{data.ref}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Artist</div>
            <div className="font-display text-lg">{artistName}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Estimated Range</div>
            <div className="font-mono text-lg">
              {formatCents(data.estimated_range.low, data.estimated_range.currency as any)} – {formatCents(data.estimated_range.high, data.estimated_range.currency as any)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              This is an indicative envelope. Formal quotation follows review.
            </div>
          </div>
          <p className="text-sm text-muted-foreground border-t border-border/60 pt-4">{data.message}</p>
        </div>
      </div>
    </div>
  );
}
