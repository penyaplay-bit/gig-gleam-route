import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getBooking, updateBookingStatus, saveQuote, addNote, verifyDeposit, rejectDeposit, getDepositPreviewUrl,
} from "@/lib/bookings.functions";
import { STATUS_META, formatDate, formatDateLong, formatM } from "@/lib/formatting";
import { bandLabel } from "@/lib/booking-score";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/bookings/$id")({
  component: BookingDetail,
});

const STATUSES = [
  "new","reviewing","quote_sent","offer_submitted","counter_offer","deposit_pending","confirmed","completed","cancelled","declined",
] as const;

function BookingDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getBooking);
  const setStatus = useServerFn(updateBookingStatus);
  const save = useServerFn(saveQuote);
  const note = useServerFn(addNote);
  const verify = useServerFn(verifyDeposit);
  const reject = useServerFn(rejectDeposit);
  const preview = useServerFn(getDepositPreviewUrl);

  const { data } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => get({ data: { id } }),
  });

  const [quote, setQuote] = useState<string>("");
  const [depositPct, setDepositPct] = useState<string>("50");
  const [noteBody, setNoteBody] = useState("");

  const b = data?.booking as any;
  const notes = data?.notes as any[] ?? [];
  const deposits = data?.deposits as any[] ?? [];

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["booking", id] });
    await qc.invalidateQueries({ queryKey: ["bookings"] });
  }

  async function doStatus(s: (typeof STATUSES)[number]) {
    try {
      await setStatus({ data: { id, status: s } });
      toast.success(`Status → ${s}`);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function doQuote() {
    const amt = parseInt(quote, 10);
    const pct = parseInt(depositPct, 10);
    if (!amt || amt <= 0) return toast.error("Enter a quote amount");
    try {
      await save({ data: { id, quoted_amount: amt, deposit_pct: pct } });
      toast.success("Quote saved & sent");
      setQuote("");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function doNote() {
    if (!noteBody.trim()) return;
    try {
      await note({ data: { booking_id: id, body: noteBody.trim() } });
      setNoteBody("");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function viewPOP(path: string) {
    try {
      const { url } = await preview({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch (e) { toast.error("Cannot preview"); }
  }

  if (!b) return <div className="py-12 text-muted-foreground text-center">Loading…</div>;

  const meta = STATUS_META[b.status];
  const band = bandLabel(b.score >= 85 ? "hot" : b.score >= 65 ? "warm" : b.score >= 45 ? "cool" : "cold");

  const waNumber = (b.contact_whatsapp || b.contact_phone || "").replace(/[^\d+]/g, "");
  const waLink = waNumber
    ? `https://wa.me/${waNumber.replace(/^\+/, "")}?text=${encodeURIComponent(
        `Hi ${b.contact_name}, this is Penya Play regarding booking ${b.ref} — ${b.event_name}.`,
      )}`
    : null;

  return (
    <div className="max-w-5xl mx-auto">
      <Link to={"/admin/pipeline" as never} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Pipeline
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display">{b.event_name}</h1>
            <span className={`text-xs rounded-full border px-2 py-0.5 ${band.color}`}>Score {b.score} · {band.label}</span>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            <span className="font-mono text-primary">{b.ref}</span> · {b.artists?.name} · {formatDateLong(b.event_date)} · {b.city}, {b.country}
          </p>
        </div>
        <span className={`text-xs rounded-full border px-3 py-1 ${meta?.tone ?? ""}`}>{meta?.label}</span>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-5">
            <h2 className="font-display mb-3">Event details</h2>
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Type</dt><dd className="col-span-2">{b.event_type} · {b.event_class}</dd>
              <dt className="text-muted-foreground">Venue</dt><dd className="col-span-2">{b.venue ?? "—"}</dd>
              <dt className="text-muted-foreground">Time</dt><dd className="col-span-2">{b.start_time ?? "?"} – {b.end_time ?? "?"}{b.ends_after_10pm && " · overnight likely"}</dd>
              <dt className="text-muted-foreground">Crowd / ticket</dt><dd className="col-span-2">{b.crowd_size ?? "—"} pax · {b.ticket_price ? formatM(b.ticket_price) : "free"}</dd>
              <dt className="text-muted-foreground">Sponsors / media</dt><dd className="col-span-2">{b.has_sponsors ? "Sponsors ✓" : "—"} {b.has_media && "· Media ✓"}</dd>
              <dt className="text-muted-foreground">Package</dt><dd className="col-span-2">{b.packages?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Client offer</dt><dd className="col-span-2">{b.client_offer ? formatM(b.client_offer) : (b.budget_min ? `min ${formatM(b.budget_min)}` : "—")}</dd>
              <dt className="text-muted-foreground">Deposit-ready</dt><dd className="col-span-2">{b.deposit_ready ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Proof link</dt><dd className="col-span-2">{b.proof_link ? <a href={b.proof_link} target="_blank" rel="noopener noreferrer" className="text-primary underline">{b.proof_link}</a> : "—"}</dd>
              <dt className="text-muted-foreground">Notes</dt><dd className="col-span-2 whitespace-pre-wrap">{b.description ?? "—"}</dd>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="font-display mb-3">Quote</h2>
            {b.quoted_amount ? (
              <div className="space-y-1 text-sm">
                <Row label="Total" value={formatM(b.quoted_amount)} />
                <Row label={`Deposit (${b.deposit_pct}%)`} value={formatM(b.deposit_amount)} />
                <Row label="Balance" value={formatM(b.balance_amount)} />
                {b.deposit_verified_at && <div className="mt-2 text-xs text-emerald-400">Deposit verified {formatDate(b.deposit_verified_at)}</div>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No quote yet.</p>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Total (M)</Label>
                <Input type="number" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="e.g. 75000" />
              </div>
              <div>
                <Label className="text-xs">Deposit %</Label>
                <Input type="number" value={depositPct} onChange={(e) => setDepositPct(e.target.value)} />
              </div>
            </div>
            <Button size="sm" className="mt-3" onClick={doQuote}>Save & mark quote sent</Button>
          </Card>

          <Card className="p-5">
            <h2 className="font-display mb-3">Deposits</h2>
            {deposits.length === 0 && <p className="text-sm text-muted-foreground">No POP uploaded yet.</p>}
            <div className="space-y-2">
              {deposits.map((d) => (
                <div key={d.id} className="rounded border border-border/60 p-3 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <div>{formatM(d.amount)} · {d.method} {d.reference && `· ${d.reference}`}</div>
                    <div className="text-xs text-muted-foreground">Uploaded {d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : "—"} · <span className="uppercase">{d.status}</span></div>
                  </div>
                  <div className="flex gap-1">
                    {d.pop_path && <Button size="sm" variant="outline" onClick={() => viewPOP(d.pop_path)}>Preview</Button>}
                    {d.status === "uploaded" && (
                      <>
                        <Button size="sm" onClick={async () => { await verify({ data: { deposit_id: d.id } }); toast.success("Verified & booking confirmed"); await refresh(); }}>Verify</Button>
                        <Button size="sm" variant="destructive" onClick={async () => { await reject({ data: { deposit_id: d.id } }); await refresh(); }}>Reject</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Public deposit link: <Link to={"/pay/$ref" as never} params={{ ref: b.ref } as never} className="text-primary underline">/pay/{b.ref}</Link>
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="font-display mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Internal notes</h2>
            <Textarea rows={3} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note visible to staff only…" />
            <Button size="sm" className="mt-2" onClick={doNote}>Add note</Button>
            <ul className="mt-4 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded border border-border/50 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                  <div className="mt-1 whitespace-pre-wrap">{n.body}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h3 className="font-display mb-3">Contact</h3>
            <div className="text-sm space-y-1">
              <div className="font-medium">{b.contact_name}</div>
              {b.promoters?.company && <div className="text-muted-foreground">{b.promoters.company}</div>}
              <div><a className="text-primary underline" href={`mailto:${b.contact_email}`}>{b.contact_email}</a></div>
              {b.contact_phone && <div>{b.contact_phone}</div>}
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-md bg-emerald-600 text-white px-3 py-1.5 text-xs">
                  WhatsApp {b.contact_name}
                </a>
              )}
              <div className="pt-2 text-xs text-muted-foreground">
                Prefers: {b.preferred_contact}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display mb-3">Change status</h3>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={b.status === s ? "default" : "outline"}
                  onClick={() => doStatus(s)}
                  className="text-xs"
                >
                  {STATUS_META[s]?.label ?? s}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              "Confirmed" requires a verified deposit.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="font-display mb-3">Score breakdown</h3>
            {b.score_breakdown?.parts ? (
              <div className="text-xs space-y-1">
                {Object.entries(b.score_breakdown.parts).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="capitalize text-muted-foreground">{k}</span><span className="font-mono">{v as number}</span></div>
                ))}
                {b.score_breakdown.notes?.length > 0 && (
                  <ul className="mt-3 space-y-1 text-muted-foreground">
                    {b.score_breakdown.notes.map((n: string, i: number) => (<li key={i}>· {n}</li>))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No breakdown</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b border-border/40 py-1.5"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}</span></div>;
}
