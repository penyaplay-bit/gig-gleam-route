import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPromoters } from "@/lib/bookings.functions";
import { formatM } from "@/lib/formatting";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/promoters")({
  component: Promoters,
});

function Promoters() {
  const list = useServerFn(listPromoters);
  const { data } = useQuery({ queryKey: ["promoters"], queryFn: () => list() });
  const promoters = (data?.promoters ?? []) as any[];
  return (
    <div>
      <h1 className="text-2xl font-display mb-6">Promoters CRM</h1>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Company</th>
              <th className="text-left px-3 py-2">Contact</th>
              <th className="text-right px-3 py-2">Bookings</th>
              <th className="text-right px-3 py-2">Revenue</th>
              <th className="text-right px-3 py-2">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {promoters.map((p) => (
              <tr key={p.id} className="border-t border-border/50">
                <td className="px-3 py-2">{p.name}{p.blacklisted && <span className="ml-2 text-xs text-red-400">blacklisted</span>}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.company ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{p.email}{p.phone && <div className="text-muted-foreground">{p.phone}</div>}</td>
                <td className="px-3 py-2 text-right font-mono">{p.bookings_count}</td>
                <td className="px-3 py-2 text-right font-mono">{formatM(p.total_revenue)}</td>
                <td className="px-3 py-2 text-right font-mono">{p.reliability_score}</td>
              </tr>
            ))}
            {promoters.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No promoters yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
