import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBookings } from "@/lib/bookings.functions";
import { PIPELINE_COLUMNS, STATUS_META, formatDate, formatM } from "@/lib/formatting";
import { bandLabel } from "@/lib/booking-score";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/pipeline")({
  component: Pipeline,
});

interface B {
  id: string;
  ref: string;
  status: string;
  event_name: string;
  event_date: string;
  city: string;
  score: number;
  quoted_amount: number | null;
  artists: { name: string } | null;
  promoters: { name: string; company: string | null } | null;
}

function Pipeline() {
  const router = useRouter();
  const fetchList = useServerFn(listBookings);
  const { data } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => fetchList(),
  });
  const bookings = (data?.bookings ?? []) as B[];

  const byStatus = (s: string) => bookings.filter((b) => b.status === s);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display">Pipeline</h1>
          <p className="text-sm text-muted-foreground">{bookings.length} bookings · drag not yet enabled</p>
        </div>
      </div>

      <div className="grid grid-flow-col auto-cols-[280px] gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((col) => {
          const items = byStatus(col.status);
          return (
            <div key={col.status} className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm font-medium">{col.title}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((b) => {
                  const band = bandLabel(
                    b.score >= 85 ? "hot" : b.score >= 65 ? "warm" : b.score >= 45 ? "cool" : "cold",
                  );
                  return (
                    <Link
                      key={b.id}
                      to={"/admin/bookings/$id" as never}
                      params={{ id: b.id }}
                      className="block"
                    >
                      <Card className="p-3 hover:border-primary/40 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-primary">{b.ref}</span>
                          <span className={`text-[10px] rounded-full px-1.5 py-0.5 border ${band.color}`}>{b.score}</span>
                        </div>
                        <div className="mt-2 text-sm font-medium truncate">{b.event_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">{b.artists?.name} · {b.city}</div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{formatDate(b.event_date)}</span>
                          <span className="font-mono text-foreground/80">{b.quoted_amount ? formatM(b.quoted_amount) : "no quote"}</span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
                {items.length === 0 && <div className="text-xs text-muted-foreground/60 px-1 py-4">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
