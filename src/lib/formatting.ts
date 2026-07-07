export function formatM(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}M ${Math.abs(Math.round(n)).toLocaleString()}`;
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateLong(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function newBookingRef(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `PP-${out}`;
}

export const STATUS_META: Record<
  string,
  { label: string; tone: string; column: string }
> = {
  new: { label: "New request", tone: "bg-blue-500/15 text-blue-300 border-blue-500/30", column: "New" },
  reviewing: { label: "Reviewing", tone: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", column: "Reviewing" },
  quote_sent: { label: "Quote sent", tone: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", column: "Quote sent" },
  offer_submitted: { label: "Offer submitted", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30", column: "Offer in" },
  counter_offer: { label: "Counter-offer sent", tone: "bg-orange-500/15 text-orange-300 border-orange-500/30", column: "Negotiating" },
  deposit_pending: { label: "Deposit pending", tone: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", column: "Deposit pending" },
  confirmed: { label: "Confirmed", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", column: "Confirmed" },
  completed: { label: "Completed", tone: "bg-teal-500/15 text-teal-300 border-teal-500/30", column: "Completed" },
  cancelled: { label: "Cancelled", tone: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", column: "Cancelled" },
  declined: { label: "Declined", tone: "bg-red-500/15 text-red-300 border-red-500/30", column: "Declined" },
};

export const PIPELINE_COLUMNS: Array<{ status: string; title: string }> = [
  { status: "new", title: "New" },
  { status: "reviewing", title: "Reviewing" },
  { status: "quote_sent", title: "Quote sent" },
  { status: "counter_offer", title: "Negotiating" },
  { status: "deposit_pending", title: "Deposit pending" },
  { status: "confirmed", title: "Confirmed" },
  { status: "completed", title: "Completed" },
];
