// Manager: list of my applications.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyApplications, withdrawApplication } from "@/lib/gigs/applications.functions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_signedin/my-applications")({
  component: MyApps,
});

function fmt(cents: number, currency = "ZAR") {
  return `${currency} ${Math.round(cents / 100).toLocaleString()}`;
}

function MyApps() {
  const fetch = useServerFn(listMyApplications);
  const withdraw = useServerFn(withdrawApplication);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-applications"], queryFn: () => fetch() });
  const apps = data?.applications ?? [];

  async function doWithdraw(id: string) {
    try {
      await withdraw({ data: { id } });
      toast.success("Withdrawn");
      qc.invalidateQueries({ queryKey: ["my-applications"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const tone: Record<string, string> = {
    submitted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    shortlisted: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    booked: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-300 border-red-500/30",
    withdrawn: "bg-muted text-muted-foreground",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display">My applications</h1>
        <Link to="/find-gigs" className="text-sm text-primary hover:underline">Browse more gigs</Link>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : apps.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          You haven't applied to any gigs yet.{" "}
          <Link to="/find-gigs" className="text-primary underline">Find one</Link>.
        </Card>
      ) : (
        <div className="grid gap-3">
          {apps.map((a: any) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link to="/find-gigs/$id" params={{ id: a.gigs.id }} className="font-display text-lg hover:text-primary">
                    {a.gigs.event_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {a.gigs.city}, {a.gigs.country} · {new Date(a.gigs.event_date).toLocaleDateString("en-GB")}
                    {a.artist_rosters?.artist_name && ` · with ${a.artist_rosters.artist_name}`}
                  </p>
                  <p className="text-sm mt-1">Quote: <b>{fmt(a.quote_cents, a.currency)}</b></p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] uppercase rounded-full border px-2 py-1 ${tone[a.status] || "bg-muted"}`}>{a.status}</span>
                  {a.status === "submitted" && (
                    <div className="mt-2">
                      <Button size="sm" variant="ghost" onClick={() => doWithdraw(a.id)}>Withdraw</Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
