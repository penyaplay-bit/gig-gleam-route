// Admin: verify promoters and managers.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUnverifiedProfiles, verifyPromoter, verifyManager } from "@/lib/gigs/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/verify")({
  component: AdminVerifyPage,
});

function AdminVerifyPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listUnverifiedProfiles);
  const vPromoter = useServerFn(verifyPromoter);
  const vManager = useServerFn(verifyManager);
  const { data, isLoading } = useQuery({ queryKey: ["admin-verify"], queryFn: () => fetch() });

  async function toggleP(id: string, verified: boolean) {
    try { await vPromoter({ data: { id, verified } }); toast.success(verified ? "Verified" : "Unverified"); qc.invalidateQueries({ queryKey: ["admin-verify"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function toggleM(id: string, verified: boolean) {
    try { await vManager({ data: { id, verified } }); toast.success(verified ? "Verified" : "Unverified"); qc.invalidateQueries({ queryKey: ["admin-verify"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-display mb-6">Verify accounts</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="font-display text-lg mb-3">Promoters ({data.promoters.length})</h2>
          <div className="grid gap-2">
            {data.promoters.map((p: any) => (
              <Card key={p.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{p.company_name || p.contact_name}</p>
                  <p className="text-xs text-muted-foreground">{p.contact_name} · {p.city || "?"}, {p.country || "?"} · {p.confirmed_bookings} bookings · trust {p.trust_score}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.verified && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40"><ShieldCheck className="w-3 h-3 mr-1"/>Verified</Badge>}
                  <Button size="sm" variant={p.verified ? "ghost" : "default"} onClick={() => toggleP(p.id, !p.verified)}>
                    {p.verified ? "Revoke" : "Verify"}
                  </Button>
                </div>
              </Card>
            ))}
            {data.promoters.length === 0 && <p className="text-sm text-muted-foreground">No promoters yet.</p>}
          </div>
        </section>
        <section>
          <h2 className="font-display text-lg mb-3">Managers ({data.managers.length})</h2>
          <div className="grid gap-2">
            {data.managers.map((m: any) => (
              <Card key={m.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{m.agency_name || m.contact_name}</p>
                  <p className="text-xs text-muted-foreground">{m.contact_name} · {m.city || "?"}, {m.country || "?"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.verified && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40"><ShieldCheck className="w-3 h-3 mr-1"/>Verified</Badge>}
                  <Button size="sm" variant={m.verified ? "ghost" : "default"} onClick={() => toggleM(m.id, !m.verified)}>
                    {m.verified ? "Revoke" : "Verify"}
                  </Button>
                </div>
              </Card>
            ))}
            {data.managers.length === 0 && <p className="text-sm text-muted-foreground">No managers yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
