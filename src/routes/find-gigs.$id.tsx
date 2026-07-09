// Public gig detail + apply-with-artist form.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getPublicGig } from "@/lib/gigs/gigs.functions";
import { applyToGig } from "@/lib/gigs/applications.functions";
import { listMyRoster } from "@/lib/gigs/roster.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, Users, Calendar, ShieldCheck, ArrowLeft } from "lucide-react";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";

export const Route = createFileRoute("/find-gigs/$id")({
  component: GigDetail,
});

function fmt(cents: number, currency = "ZAR") {
  return `${currency} ${Math.round(cents / 100).toLocaleString()}`;
}

function GigDetail() {
  const { id } = Route.useParams();
  const fetchGig = useServerFn(getPublicGig);
  const { data, isLoading } = useQuery({
    queryKey: ["gig-public", id],
    queryFn: () => fetchGig({ data: { id } }),
  });

  const gig = data?.gig;

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none"><CinematicBackdrop variant="ambient" /></div>
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <Link to="/find-gigs" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> All gigs
          </Link>
          <Link to="/auth" className="text-sm text-primary hover:underline">Sign in</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {isLoading || !gig ? (
          <p className="text-muted-foreground">Loading gig…</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-[1fr_400px]">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="uppercase">{gig.status}</Badge>
                {gig.promoter_profiles?.verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <ShieldCheck className="w-3 h-3" /> Verified promoter · Trust {gig.promoter_profiles.trust_score}
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-display leading-tight mb-4">{gig.event_name}</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <Stat label="Date" value={new Date(gig.event_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} icon={<Calendar className="w-3 h-3" />} />
                <Stat label="Venue" value={gig.venue} icon={<MapPin className="w-3 h-3" />} />
                <Stat label="Crowd" value={gig.crowd_size.toLocaleString()} icon={<Users className="w-3 h-3" />} />
                <Stat label="Budget" value={`${fmt(gig.budget_low_cents, gig.currency)}–${fmt(gig.budget_high_cents, gig.currency)}`} />
              </div>
              <Card className="p-6 mb-6 bg-card/60">
                <h2 className="text-sm uppercase tracking-widest text-primary mb-3">Brief</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{gig.description || "No description provided."}</p>
              </Card>
              {gig.genre_needed?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Genres wanted</p>
                  <div className="flex flex-wrap gap-1">
                    {gig.genre_needed.map((g: string) => (
                      <Badge key={g} variant="outline">{g}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {gig.artist_type_needed?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Artist types</p>
                  <div className="flex flex-wrap gap-1">
                    {gig.artist_type_needed.map((t: string) => (
                      <Badge key={t} variant="outline">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-6 text-xs text-muted-foreground">Applications close {new Date(gig.application_deadline).toLocaleDateString("en-GB")}</p>
            </div>
            <ApplyPanel gigId={gig.id} currency={gig.currency} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm mt-1 truncate">{value}</p>
    </div>
  );
}

function ApplyPanel({ gigId, currency }: { gigId: string; currency: string }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSession(!!data.user));
  }, []);

  const fetchRoster = useServerFn(listMyRoster);
  const apply = useServerFn(applyToGig);
  const { data: rosterData } = useQuery({
    queryKey: ["my-roster"],
    queryFn: () => fetchRoster(),
    enabled: session === true,
  });

  const [rosterId, setRosterId] = useState("");
  const [quote, setQuote] = useState("");
  const [availability, setAvailability] = useState("");
  const [rider, setRider] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (session === null) return <Card className="p-6 bg-card/60">Loading…</Card>;
  if (session === false) {
    return (
      <Card className="p-6 bg-card/60 sticky top-24 h-fit">
        <h3 className="font-display text-lg mb-2">Apply to this gig</h3>
        <p className="text-sm text-muted-foreground mb-4">Sign in as a manager to submit your artist and quote.</p>
        <Link to="/auth" search={{ next: `/find-gigs/${gigId}` }} className="w-full inline-flex justify-center items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
          Sign in to apply
        </Link>
      </Card>
    );
  }

  const roster = rosterData?.roster ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const quoteZar = Number(quote);
      if (!Number.isFinite(quoteZar) || quoteZar <= 0) throw new Error("Enter a valid quote.");
      await apply({
        data: {
          gig_id: gigId,
          roster_artist_id: rosterId || undefined,
          quote_cents: Math.round(quoteZar * 100),
          currency,
          availability_notes: availability || undefined,
          rider_notes: rider || undefined,
          message: message || undefined,
        },
      });
      toast.success("Application submitted!");
      navigate({ to: "/my-applications" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6 bg-card/60 sticky top-24 h-fit">
      <h3 className="font-display text-lg mb-4">Apply with an artist</h3>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Artist from your roster</Label>
          {roster.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-1">
              No artists yet.{" "}
              <Link to="/my-roster" className="text-primary underline">Add one to your roster</Link>{" "}
              or apply without.
            </p>
          ) : (
            <select
              value={rosterId}
              onChange={(e) => setRosterId(e.target.value)}
              className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— No specific artist —</option>
              {roster.map((r: any) => (
                <option key={r.id} value={r.id}>{r.artist_name} {r.genre ? `· ${r.genre}` : ""}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <Label htmlFor="quote">Quote ({currency})</Label>
          <Input id="quote" type="number" required value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="e.g. 45000" />
        </div>
        <div>
          <Label htmlFor="availability">Availability notes</Label>
          <Input id="availability" value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Available all day" />
        </div>
        <div>
          <Label htmlFor="rider">Rider notes</Label>
          <Textarea id="rider" rows={2} value={rider} onChange={(e) => setRider(e.target.value)} placeholder="Sound, lighting, hospitality requirements" />
        </div>
        <div>
          <Label htmlFor="message">Message to promoter</Label>
          <Textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Why this artist is right for the gig" />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Submitting…" : "Submit application"}
        </Button>
      </form>
    </Card>
  );
}
