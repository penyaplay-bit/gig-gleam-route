import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatDateLong } from "@/lib/formatting";

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center">
          <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
          <h1 className="mt-4 text-3xl font-display">Request received</h1>
          <p className="mt-2 text-muted-foreground">
            Our ops team will review your request and reply within 24 hours.
          </p>
        </div>

        <Card className="mt-8 p-6 border-primary/20 bg-card/60">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Reference</div>
              <div className="mt-1 text-2xl font-mono text-primary">{ref}</div>
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
