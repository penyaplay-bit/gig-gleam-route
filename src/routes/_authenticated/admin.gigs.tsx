// Admin moderation queue for marketplace gigs.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listPendingGigs, approveGig, rejectGig } from "@/lib/gigs/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/gigs")({
  component: AdminGigsPage,
});

function fmt(cents: number, currency = "ZAR") {
  return `${currency} ${Math.round(cents / 100).toLocaleString()}`;
}

function AdminGigsPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listPendingGigs);
  const approve = useServerFn(approveGig);
  const reject = useServerFn(rejectGig);
  const { data, isLoading } = useQuery({ queryKey: ["admin-gigs"], queryFn: () => fetch() });
  const [filter, setFilter] = useState<"pending_review" | "all">("pending_review");
  const gigs = (data?.gigs ?? []).filter((g: any) => filter === "all" || g.status === filter);

  async function doApprove(id: string) {
    try { await approve({ data: { id } }); toast.success("Gig approved & live"); qc.invalidateQueries({ queryKey: ["admin-gigs"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function doReject(id: string) {
    const reason = window.prompt("Rejection reason (optional):") ?? undefined;
    try { await reject({ data: { id, reason } }); toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["admin-gigs"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Marketplace gigs</h1>
        <div className="flex gap-2">
          <Button size="sm" variant={filter === "pending_review" ? "default" : "outline"} onClick={() => setFilter("pending_review")}>Pending</Button>
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : gigs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nothing to moderate.</Card>
      ) : (
        <div className="grid gap-3">
          {gigs.map((g: any) => (
            <Card key={g.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-display text-lg">{g.event_name}</h3>
                    <Badge className="uppercase text-[10px]">{g.status}</Badge>
                    {g.promoter_profiles?.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <ShieldCheck className="w-3 h-3" /> Verified promoter
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {g.promoter_profiles?.company_name || g.promoter_profiles?.contact_name} · {g.city}, {g.country} · {new Date(g.event_date).toLocaleDateString("en-GB")} · {g.crowd_size.toLocaleString()} crowd · budget {fmt(g.budget_low_cents, g.currency)}–{fmt(g.budget_high_cents, g.currency)}
                  </p>
                  {g.description && <p className="text-sm mt-2 line-clamp-3">{g.description}</p>}
                </div>
                {g.status === "pending_review" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => doApprove(g.id)}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => doReject(g.id)}>Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
