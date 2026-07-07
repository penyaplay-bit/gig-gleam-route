import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPackages } from "@/lib/bookings.functions";
import { formatM } from "@/lib/formatting";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/packages")({
  component: Packages,
});

function Packages() {
  const list = useServerFn(listPackages);
  const { data } = useQuery({ queryKey: ["packages"], queryFn: () => list() });
  const pkgs = (data?.packages ?? []) as any[];
  return (
    <div>
      <h1 className="text-2xl font-display mb-6">Packages</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {pkgs.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.artists?.name} · {p.crew_size} crew · {p.duration_minutes ? `${p.duration_minutes} min` : "custom"}</div>
              </div>
              <div className="text-primary font-mono">{formatM(p.base_price)}</div>
            </div>
            {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Editing packages inline — coming next turn.</p>
    </div>
  );
}
