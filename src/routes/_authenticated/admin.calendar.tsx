import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBookings } from "@/lib/bookings.functions";
import { formatDate, formatM } from "@/lib/formatting";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const fetchList = useServerFn(listBookings);
  const { data } = useQuery({ queryKey: ["bookings"], queryFn: () => fetchList() });
  const bookings = (data?.bookings ?? []) as any[];

  // Group by month
  const groups = new Map<string, any[]>();
  for (const b of bookings) {
    const d = new Date(b.event_date);
    const key = d.toLocaleString("en-ZA", { year: "numeric", month: "long" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  // Conflict detection: same artist, same day → red; same weekend → amber
  function conflictClass(b: any): string {
    const d = new Date(b.event_date);
    const sameDay = bookings.filter((x) => x.id !== b.id && x.artists?.name === b.artists?.name && x.event_date === b.event_date);
    if (sameDay.length > 0) return "border-red-500/40 bg-red-500/5";
    const dow = d.getDay();
    if (dow >= 5) {
      const same = bookings.filter((x) => x.id !== b.id && x.artists?.name === b.artists?.name && Math.abs((new Date(x.event_date).getTime() - d.getTime()) / 86400000) <= 2);
      if (same.length > 0) return "border-amber-500/40 bg-amber-500/5";
    }
    return "border-border";
  }

  return (
    <div>
      <h1 className="text-2xl font-display mb-6">Calendar</h1>
      {groups.size === 0 && <p className="text-muted-foreground">No bookings scheduled.</p>}
      <div className="space-y-6">
        {[...groups.entries()].map(([month, items]) => (
          <div key={month}>
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-2">{month}</h2>
            <div className="grid gap-2">
              {items.sort((a: any, b: any) => a.event_date.localeCompare(b.event_date)).map((b: any) => (
                <Link key={b.id} to={"/admin/bookings/$id" as never} params={{ id: b.id }}>
                  <Card className={`p-3 flex items-center justify-between ${conflictClass(b)}`}>
                    <div>
                      <div className="text-sm font-medium">{formatDate(b.event_date)} · {b.event_name}</div>
                      <div className="text-xs text-muted-foreground">{b.artists?.name} · {b.city} · <span className="font-mono">{b.ref}</span></div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono">{b.quoted_amount ? formatM(b.quoted_amount) : "—"}</div>
                      <div className="text-muted-foreground">{b.status}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Red = same-day artist conflict · Amber = same-weekend conflict
      </p>
    </div>
  );
}
