// Promoter: list of my gigs.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyGigs } from "@/lib/gigs/gigs.functions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_signedin/my-gigs")({
  component: MyGigs,
});

function MyGigs() {
  const fetchGigs = useServerFn(listMyGigs);
  const { data, isLoading } = useQuery({ queryKey: ["my-gigs"], queryFn: () => fetchGigs() });
  const gigs = data?.gigs ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display">My gigs</h1>
        <Link to="/post-gig" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">+ Post a gig</Link>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : gigs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No gigs yet. Post your first one.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {gigs.map((g: any) => (
            <Link key={g.id} to="/my-gigs/$id" params={{ id: g.id }} className="block rounded-xl border border-border bg-card/60 p-4 hover:border-primary/40">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg">{g.event_name}</h3>
                  <p className="text-xs text-muted-foreground">{g.city}, {g.country} · {new Date(g.event_date).toLocaleDateString("en-GB")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="uppercase text-[10px]">{g.status}</Badge>
                  <span className="text-xs text-muted-foreground">{g.gig_applications?.length ?? 0} apps</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
