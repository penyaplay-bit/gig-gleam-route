import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { CheckCircle2, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatDateLong } from "@/lib/formatting";
import { LogoLockup } from "@/components/brand/logo-mark";
import { GrainOverlay } from "@/components/brand/grain";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";

export const Route = createFileRoute("/book/confirm/$ref")({
  head: ({ params }) => ({
    meta: [
      { title: `Booking ${params.ref} — Penya Play` },
      { name: "description", content: "Your booking request has been received. Reference recorded." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmPage,
});

interface Booking {
  ref: string;
  event_name: string;
  event_date: string;
  city: string;
  country: string;
  venue: string | null;
  status: string;
  artists: { name: string } | null;
  packages: { name: string } | null;
}

function ConfirmPage() {
  const { ref } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["public-booking", ref],
    queryFn: async () => {
      const r = await fetch(`/api/public/bookings/${ref}`);
      if (!r.ok) throw new Error("Booking not found");
      return (await r.json()) as { booking: Booking };
    },
  });

  const b = data?.booking;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GrainOverlay />
      <header className="border-b border-primary/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/"><LogoLockup /></Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <div className="relative mx-auto inline-block">
            <div className="absolute -inset-6 rounded-full bg-primary/30 blur-2xl" aria-hidden />
            <CheckCircle2 className="relative mx-auto h-16 w-16 text-primary" />
          </div>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
            <Sparkles className="h-3 w-3" /> Request received
          </span>
          <h1 className="mt-4 font-display text-5xl font-black leading-none">You're in.</h1>
          <p className="mt-3 text-muted-foreground">
            Our ops team is reviewing your request. Expect a written quote within 24 hours.
          </p>
        </motion.div>

        <Card className="mt-10 border-primary/25 bg-card/60 p-6 shadow-quote">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Reference</div>
              <div className="mt-1 font-mono text-3xl text-goldleaf">{ref}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(ref);
                toast.success("Reference copied");
              }}
            >
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
          </div>


          {isLoading ? (
            <div className="mt-6 text-sm text-muted-foreground">Loading details…</div>
          ) : b ? (
            <dl className="mt-6 grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Artist</dt>
              <dd className="col-span-2">{b.artists?.name}</dd>
              <dt className="text-muted-foreground">Package</dt>
              <dd className="col-span-2">{b.packages?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Event</dt>
              <dd className="col-span-2">{b.event_name}</dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="col-span-2">{formatDateLong(b.event_date)}</dd>
              <dt className="text-muted-foreground">Where</dt>
              <dd className="col-span-2">{b.venue ? `${b.venue}, ` : ""}{b.city}, {b.country}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="col-span-2">
                <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">
                  Pending review
                </span>
              </dd>
            </dl>
          ) : null}

          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            <strong>Your date is not confirmed.</strong> A booking becomes final only after the deposit is paid and verified.
            You'll receive a quote and payment instructions shortly.
          </div>
        </Card>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
