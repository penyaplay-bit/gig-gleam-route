// Promoter: gig detail + applications comparison.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyGig } from "@/lib/gigs/gigs.functions";
import { shortlistApplication, rejectApplication, bookApplication } from "@/lib/gigs/applications.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_signedin/my-gigs/$id")({
  component: MyGigDetail,
});

function fmt(cents: number, currency = "ZAR") {
  return `${currency} ${Math.round(cents / 100).toLocaleString()}`;
}

function MyGigDetail() {
  const { id } = Route.useParams();
  const fetch = useServerFn(getMyGig);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-gig", id], queryFn: () => fetch({ data: { id } }) });
  const shortlist = useServerFn(shortlistApplication);
  const reject = useServerFn(rejectApplication);
  const book = useServerFn(bookApplication);

  async function act(fn: any, appId: string, label: string) {
    try {
      await fn({ data: { id: appId } });
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["my-gig", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  const { gig, applications } = data;

  return (
    <div>
      <Link to="/my-gigs" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> All gigs
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <Badge className="uppercase">{gig.status}</Badge>
      </div>
      <h1 className="text-3xl font-display mb-2">{gig.event_name}</h1>
      <p className="text-muted-foreground mb-6">
        {gig.venue} · {gig.city}, {gig.country} · {new Date(gig.event_date).toLocaleDateString("en-GB")} · Budget {fmt(gig.budget_low_cents, gig.currency)}–{fmt(gig.budget_high_cents, gig.currency)}
      </p>

      <h2 className="text-lg font-display mb-3">Applications ({applications.length})</h2>
      {applications.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No applications yet.</Card>
      ) : (
        <div className="grid gap-3">
          {applications.map((a: any) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-display text-base">{a.artist_rosters?.artist_name || "(unspecified artist)"}</h3>
                    <Badge variant="outline" className="text-[10px] uppercase">{a.status}</Badge>
                    {a.manager_profiles?.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From: {a.manager_profiles?.agency_name || a.manager_profiles?.contact_name}
                    {a.artist_rosters?.genre && ` · ${a.artist_rosters.genre}`}
                  </p>
                  {a.message && <p className="text-sm mt-2 text-foreground/90">{a.message}</p>}
                  {a.availability_notes && <p className="text-xs mt-2 text-muted-foreground"><b>Availability:</b> {a.availability_notes}</p>}
                  {a.rider_notes && <p className="text-xs mt-1 text-muted-foreground"><b>Rider:</b> {a.rider_notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-xl text-primary">{fmt(a.quote_cents, a.currency)}</p>
                  <div className="flex gap-2 mt-3">
                    {a.status === "submitted" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => act(shortlist, a.id, "Shortlisted")}>Shortlist</Button>
                        <Button size="sm" variant="ghost" onClick={() => act(reject, a.id, "Rejected")}>Reject</Button>
                      </>
                    )}
                    {(a.status === "submitted" || a.status === "shortlisted") && (
                      <Button size="sm" onClick={() => act(book, a.id, "Booked!")}>Book</Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
