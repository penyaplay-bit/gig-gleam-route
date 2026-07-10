// Slice E — Public Booking Button™ page at /book/<handle>.
// Renders a performer's public profile with a CTA into the existing booking flow.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MapPin, Sparkles, Send } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo-mark";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";
import { GrainOverlay } from "@/components/brand/grain";
import { getBookingButtonProfile } from "@/lib/onboarding/intents.functions";

export const Route = createFileRoute("/book/$handle")({
  loader: async ({ params }) => {
    const res = await getBookingButtonProfile({ data: { handle: params.handle } });
    if (!res.handle) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData?.handle) {
      return { meta: [{ title: "Booking page not found — Penya Play" }, { name: "robots", content: "noindex" }] };
    }
    const name = loaderData.profile?.stage_name || loaderData.handle.display_name || loaderData.handle.handle;
    const desc = loaderData.profile?.bio?.slice(0, 155) ||
      `Book ${name} through their Penya Play Booking Button™ — verified availability, transparent packages, secure escrow.`;
    return {
      meta: [
        { title: `Book ${name} — Penya Play` },
        { name: "description", content: desc },
        { property: "og:title", content: `Book ${name}` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData.profile?.featured_performance_thumb
          ? [
              { property: "og:image", content: loaderData.profile.featured_performance_thumb },
              { name: "twitter:image", content: loaderData.profile.featured_performance_thumb },
            ]
          : loaderData.profile?.photo_url
          ? [
              { property: "og:image", content: loaderData.profile.photo_url },
              { name: "twitter:image", content: loaderData.profile.photo_url },
            ]
          : []),
      ],
    };
  },
  component: BookingButtonPage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center px-6">
      <div>
        <h1 className="font-display text-2xl">Booking page not found</h1>
        <p className="text-sm text-muted-foreground mt-2">This Booking Button™ doesn't exist yet.</p>
        <Button asChild className="mt-4"><Link to="/">Back to Penya Play</Link></Button>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-xl">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    </div>
  ),
});

function embedUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtube.com") || url.hostname === "youtu.be") {
      const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function BookingButtonPage() {
  const { handle, profile } = Route.useLoaderData();
  const name = profile?.stage_name || handle!.display_name || handle!.handle;
  const embed = embedUrl(profile?.featured_performance_url);

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none"><CinematicBackdrop variant="ambient" /></div>
      <GrainOverlay />

      <header className="sticky top-0 z-30 border-b border-primary/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link to="/"><LogoLockup /></Link>
          <Badge variant="outline" className="text-primary border-primary/50 text-[10px] uppercase tracking-widest">
            Booking Button™
          </Badge>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-10 space-y-8">
        {/* Hero */}
        <section className="grid gap-6 md:grid-cols-[240px_1fr] items-center">
          <div className="mx-auto md:mx-0">
            <div className="relative h-40 w-40 md:h-56 md:w-56 rotate-45 overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/10 shadow-[0_0_40px_-10px] shadow-primary/50">
              {profile?.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt={name}
                  className="absolute inset-0 h-full w-full -rotate-45 scale-150 object-cover"
                />
              ) : (
                <div className="absolute inset-0 -rotate-45 grid place-items-center font-display text-4xl text-primary">
                  {name.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join("").toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="text-center md:text-left space-y-3">
            <div className="text-xs uppercase tracking-[0.32em] text-primary flex items-center gap-2 justify-center md:justify-start">
              <Sparkles className="w-3 h-3" /> {profile ? "Verified performer" : "Penya Play member"}
            </div>
            <h1 className="font-display text-4xl md:text-5xl">{name}</h1>
            {profile?.location_city && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground justify-center md:justify-start">
                <MapPin className="w-3.5 h-3.5" /> {profile.location_city}{profile.location_country ? `, ${profile.location_country}` : ""}
              </div>
            )}
            {profile?.genres?.length ? (
              <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                {profile.genres.slice(0, 6).map((g) => (
                  <Badge key={g} variant="secondary" className="capitalize">{g}</Badge>
                ))}
              </div>
            ) : null}
            <div className="pt-2">
              <Button asChild size="lg" className="gap-2">
                <Link to="/book">
                  <Send className="w-4 h-4" /> Request a booking
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Featured Performance */}
        {embed ? (
          <Card className="overflow-hidden border-primary/20">
            <div className="aspect-video w-full">
              <iframe
                src={embed}
                title={`Featured performance — ${name}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </Card>
        ) : profile?.featured_performance_thumb ? (
          <Card className="overflow-hidden border-primary/20">
            <img src={profile.featured_performance_thumb} alt={`Featured — ${name}`} className="w-full object-cover" />
          </Card>
        ) : null}

        {/* Bio */}
        {profile?.bio && (
          <Card className="p-6 border-primary/15 bg-card/60">
            <h2 className="font-display text-lg mb-2">About</h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{profile.bio}</p>
          </Card>
        )}

        <Card className="p-6 border-primary/15 bg-card/60 text-center">
          <h2 className="font-display text-xl mb-2">Send a booking request</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Your request is qualified by the Penya Play Bookings Engine — {name} sees the highest-value opportunities first.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to="/book"><Send className="w-4 h-4" /> Request a booking</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}
