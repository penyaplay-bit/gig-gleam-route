import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBookings } from "@/lib/bookings.functions";
import { STATUS_META, formatDate, formatM } from "@/lib/formatting";
import { bandLabel } from "@/lib/booking-score";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  component: BookingsList,
});

function BookingsList() {
  const fetchList = useServerFn(listBookings);
  const { data } = useQuery({ queryKey: ["bookings"], queryFn: () => fetchList() });
  const [q, setQ] = useState("");
  const bookings = (data?.bookings ?? []).filter((b: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      b.ref.toLowerCase().includes(s) ||
      b.event_name.toLowerCase().includes(s) ||
      b.city.toLowerCase().includes(s) ||
      b.contact_name?.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-display">Bookings</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Link
            to={"/admin/bookings/new" as never}
            className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90"
          >
            + New Booking
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Ref</th>
              <th className="text-left px-3 py-2">Event</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">City</th>
              <th className="text-left px-3 py-2">Score</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Quote</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b: any) => {
              const meta = STATUS_META[b.status];
              const band = bandLabel(b.score >= 85 ? "hot" : b.score >= 65 ? "warm" : b.score >= 45 ? "cool" : "cold");
              return (
                <tr key={b.id} className="border-t border-border/50 hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono text-primary">
                    <Link to={"/admin/bookings/$id" as never} params={{ id: b.id } as never}>{b.ref}</Link>
                  </td>
                  <td className="px-3 py-2">{b.event_name}<div className="text-xs text-muted-foreground">{b.artists?.name}</div></td>
                  <td className="px-3 py-2">{formatDate(b.event_date)}</td>
                  <td className="px-3 py-2">{b.city}</td>
                  <td className="px-3 py-2"><span className={`text-xs rounded-full border px-2 py-0.5 ${band.color}`}>{b.score}</span></td>
                  <td className="px-3 py-2"><span className={`text-xs rounded-full border px-2 py-0.5 ${meta?.tone ?? ""}`}>{meta?.label ?? b.status}</span></td>
                  <td className="px-3 py-2 text-right font-mono">{b.quoted_amount ? formatM(b.quoted_amount) : "—"}</td>
                </tr>
              );
            })}
            {bookings.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">No bookings yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
