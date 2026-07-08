// Public gig marketplace browse.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listOpenGigs } from "@/lib/gigs/gigs.functions";
import { listSavedGigs, toggleSaveGig } from "@/lib/gigs/saved.functions";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Calendar, DollarSign, Clock, ShieldCheck, ArrowRight, Heart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/find-gigs")({
  head: () => ({
    meta: [
      { title: "Find Gigs — Fare Deal Bookings marketplace" },
      { name: "description", content: "Browse open booking opportunities across Africa. Filter by budget, location, and genre. Apply with your artist." },
      { property: "og:title", content: "Find Gigs — Fare Deal Bookings" },
      { property: "og:description", content: "Two-sided gig marketplace for managers, promoters, and artists." },
    ],
  }),
  component: FindGigsPage,
});

function fmtMoney(cents: number, currency = "ZAR") {
  const v = Math.round(cents / 100);
  return `${currency} ${v.toLocaleString()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d;
}

function FindGigsPage() {
  const fetchGigs = useServerFn(listOpenGigs);
  const fetchSaved = useServerFn(listSavedGigs);
  const toggleSave = useServerFn(toggleSaveGig);
  const qc = useQueryClient();
  const [city, setCity] = useState("");
  const [genre, setGenre] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["open-gigs", city, genre, minBudget, verifiedOnly],
    queryFn: () =>
      fetchGigs({
        data: {
          city: city || undefined,
          genre: genre || undefined,
          min_budget: minBudget ? Math.round(Number(minBudget) * 100) : undefined,
          verified_only: verifiedOnly || undefined,
        },
      }),
  });

  const { data: savedData } = useQuery({
    queryKey: ["saved-gigs"],
    queryFn: () => fetchSaved(),
    enabled: signedIn,
  });
  const savedIds = new Set<string>(savedData?.savedIds ?? []);

  const saveMutation = useMutation({
    mutationFn: (gigId: string) => toggleSave({ data: { gig_id: gigId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["saved-gigs"] });
      toast.success(res.saved ? "Gig saved" : "Removed from saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed. Verified manager profile required."),
  });

  const gigs = data?.gigs ?? [];

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-primary">◆</span>
            <span className="font-display tracking-wider text-sm">FARE DEAL <span className="text-primary">MARKET</span></span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/post-gig" className="text-muted-foreground hover:text-foreground">Post a gig</Link>
            <Link to="/auth" className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground font-medium hover:bg-primary/90">Sign in</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pt-16 pb-10">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="relative">
          <p className="text-primary text-xs uppercase tracking-[0.3em] mb-3">The Marketplace</p>
          <h1 className="text-4xl md:text-6xl font-display leading-tight max-w-3xl">
            Real gigs. Real budgets. <span className="text-primary">Apply direct.</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl">
            Verified promoters posting live event opportunities. Managers apply with artists from their roster. No middlemen.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="mx-auto max-w-7xl px-4 mb-8">
        <div className="rounded-2xl border border-primary/15 bg-card/40 p-4 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-5">
            <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input placeholder="Genre (e.g. amapiano)" value={genre} onChange={(e) => setGenre(e.target.value)} />
            <Input
              type="number"
              placeholder="Min budget (ZAR)"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground px-3">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="accent-primary"
              />
              Verified promoters only
            </label>
            <Button onClick={() => refetch()} className="w-full">Search</Button>
          </div>
        </div>
      </section>

      {/* Gig grid */}
      <section className="mx-auto max-w-7xl px-4 pb-24">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-16">Loading gigs…</div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg font-display">No open gigs match your filters.</p>
            <p className="mt-2 text-muted-foreground text-sm">Try broadening your search, or check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {gigs.map((g: any) => (
              <GigCard
                key={g.id}
                gig={g}
                saved={savedIds.has(g.id)}
                canSave={signedIn}
                onToggleSave={() => saveMutation.mutate(g.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GigCard({
  gig,
  saved,
  canSave,
  onToggleSave,
}: {
  gig: any;
  saved: boolean;
  canSave: boolean;
  onToggleSave: () => void;
}) {
  const deadlineDays = daysUntil(gig.application_deadline);
  const p = gig.promoter_profiles;
  const statusMap: Record<string, { label: string; tone: string }> = {
    open: { label: "OPEN", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    reviewing: { label: "REVIEWING", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    shortlisted: { label: "SHORTLISTED", tone: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  };
  const s = statusMap[gig.status] ?? { label: gig.status.toUpperCase(), tone: "bg-muted text-muted-foreground" };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary/10 bg-card/60 p-5 backdrop-blur transition hover:border-primary/40 hover:-translate-y-0.5">
      <Link to="/find-gigs/$id" params={{ id: gig.id }} className="absolute inset-0 z-0" aria-label={gig.event_name} />
      {gig.boost_until && new Date(gig.boost_until) > new Date() && (
        <span className="absolute right-14 top-4 z-10 text-[10px] uppercase font-bold tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
          Boosted
        </span>
      )}
      {canSave && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSave();
          }}
          className={`absolute right-4 top-4 z-10 rounded-full border p-1.5 backdrop-blur transition ${
            saved
              ? "border-primary/60 bg-primary/20 text-primary"
              : "border-white/10 bg-black/30 text-muted-foreground hover:text-primary hover:border-primary/40"
          }`}
          aria-label={saved ? "Unsave gig" : "Save gig"}
        >
          <Heart className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
        </button>
      )}
      <div className="relative z-[1] pointer-events-none">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest mb-3">
        <span className={`rounded-full border px-2 py-0.5 ${s.tone}`}>{s.label}</span>
        {p?.verified && (
          <span className="inline-flex items-center gap-1 text-primary">
            <ShieldCheck className="w-3 h-3" /> Verified
          </span>
        )}
        {p?.trust_score > 0 && (
          <span className="text-muted-foreground">Trust {p.trust_score}</span>
        )}
      </div>
      <h3 className="font-display text-lg leading-tight mb-2 group-hover:text-primary">{gig.event_name}</h3>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {gig.city}, {gig.country}</span>
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(gig.event_date)}</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {gig.crowd_size.toLocaleString()}</span>
        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {fmtMoney(gig.budget_low_cents, gig.currency)}–{fmtMoney(gig.budget_high_cents, gig.currency)}</span>
      </div>
      {gig.genre_needed?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {gig.genre_needed.slice(0, 4).map((g: string) => (
            <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-border/50">
        <span className={`flex items-center gap-1 ${deadlineDays <= 3 ? "text-red-400" : "text-muted-foreground"}`}>
          <Clock className="w-3 h-3" />
          {deadlineDays > 0 ? `${deadlineDays}d to apply` : "Deadline passed"}
        </span>
        <span className="text-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
          View <ArrowRight className="w-3 h-3" />
        </span>
      </div>
      </div>
    </div>
  );
}
