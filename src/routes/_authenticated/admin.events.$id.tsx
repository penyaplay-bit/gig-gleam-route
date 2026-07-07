import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEvent, advanceStage, EVENT_STAGES, type EventStage } from "@/lib/engines/event.functions";
import { postMessage } from "@/lib/engines/comms.functions";
import {
  getFinancialState,
  verifyPayment,
  rejectPayment,
  extendDeadline,
  approveContinuation,
  cancelForNonPayment,
  releaseHold,
  type FinancialState,
} from "@/lib/engines/payments.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatM, formatDate } from "@/lib/formatting";
const formatCurrency = formatM;
import {
  ArrowLeft, Circle, CheckCircle2, Clock, MessageSquare, DollarSign,
  FileText, Truck, Megaphone, Image, ListTodo, FolderOpen, BarChart3,
  LayoutGrid, Users, ShieldAlert, ShieldCheck, Lock, Unlock, Activity,
} from "lucide-react";
import { PulseHeader, HealthTab } from "@/components/events/decision-engine-ui";

export const Route = createFileRoute("/_authenticated/admin/events/$id")({
  component: EventWorkspace,
});

type TabId =
  | "overview" | "health" | "timeline" | "chat" | "payments" | "contracts"
  | "travel" | "campaign" | "media" | "documents" | "tasks" | "analytics" | "parties";

const TABS: { id: TabId; label: string; Icon: typeof Circle }[] = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "health", label: "Health", Icon: Activity },
  { id: "timeline", label: "Timeline", Icon: Clock },
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "parties", label: "Parties", Icon: Users },
  { id: "payments", label: "Payments", Icon: DollarSign },
  { id: "contracts", label: "Contracts", Icon: FileText },
  { id: "travel", label: "Travel", Icon: Truck },
  { id: "campaign", label: "Campaign", Icon: Megaphone },
  { id: "media", label: "Media", Icon: Image },
  { id: "tasks", label: "Tasks", Icon: ListTodo },
  { id: "documents", label: "Documents", Icon: FolderOpen },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
];

function EventWorkspace() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const fetchEvent = useServerFn(getEvent);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEvent({ data: { id } }),
  });

  const advance = useMutation({
    mutationFn: useServerFn(advanceStage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event", id] }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading event…</div>;
  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-destructive">Failed to load event.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/admin/bookings" })}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  const ev = data.event as unknown as Record<string, unknown> & { ref: string; event_name: string; event_date: string; city: string; country: string; artists?: { name: string } | null };
  const stage = data.derivedStage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate({ to: "/admin/bookings" })}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" /> Back to events
          </button>
          <h1 className="text-2xl md:text-3xl font-display tracking-tight">{ev.event_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ev.ref} · {formatDate(ev.event_date)} · {ev.city}, {ev.country}
            {ev.artists?.name ? <> · <span className="text-primary">{ev.artists.name}</span></> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={stage} />
          <StageAdvancer
            current={stage}
            pending={advance.isPending}
            onAdvance={(s) => advance.mutate({ data: { eventId: id, stage: s } })}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-primary/10 gap-1">
        {TABS.map(({ id: t, label, Icon }) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors " +
              (tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div>
        {tab === "overview" && <OverviewTab data={data} />}
        {tab === "timeline" && <TimelineTab entries={data.timeline} />}
        {tab === "chat" && <ChatTab eventId={id} messages={data.messages} onPosted={() => qc.invalidateQueries({ queryKey: ["event", id] })} />}
        {tab === "parties" && <PartiesTab parties={data.parties} />}
        {tab === "payments" && <PaymentsTab eventId={id} payments={data.payments} />}
        {tab === "contracts" && <EmptyTab title="Contracts" hint="Contract engine wires here. Storage + signature flow next." />}
        {tab === "travel" && <TravelTab logistics={data.logistics} />}
        {tab === "campaign" && <CampaignTab campaign={data.campaign} />}
        {tab === "media" && <EmptyTab title="Media" hint="Photos & after-movies land here once uploaded." />}
        {tab === "tasks" && <TasksTab tasks={data.tasks} />}
        {tab === "documents" && <DocumentsTab documents={data.documents} />}
        {tab === "analytics" && <EmptyTab title="Analytics" hint="Per-event profit, cash flow and lead-time metrics land here." />}
      </div>
    </div>
  );
}

// ---------- Header helpers ----------

function StageBadge({ stage }: { stage: EventStage }) {
  const label = stage.replaceAll("_", " ");
  return (
    <Badge className="bg-primary/10 text-primary border border-primary/20 capitalize">
      {label}
    </Badge>
  );
}

function StageAdvancer({ current, onAdvance, pending }: {
  current: EventStage;
  onAdvance: (s: EventStage) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const next = useMemo(() => {
    const idx = EVENT_STAGES.indexOf(current);
    return EVENT_STAGES.slice(idx + 1, idx + 6);
  }, [current]);
  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)} disabled={pending}>
        Advance stage
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-20 min-w-[220px]">
          {next.map((s) => (
            <button
              key={s}
              onClick={() => { onAdvance(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent capitalize"
            >
              {s.replaceAll("_", " ")}
            </button>
          ))}
          {next.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Already at final stage.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Tabs ----------

function OverviewTab({ data }: { data: Awaited<ReturnType<typeof getEvent>> }) {
  const ev = data.event as unknown as Record<string, unknown> & {
    quoted_amount?: number | null;
    client_offer?: number | null;
    crowd_size?: number | null;
    event_class?: string;
    description?: string | null;
  };
  const paidTotal = data.payments
    .filter((p: { status: string }) => p.status === "verified")
    .reduce((s: number, p: { amount_lsl: number }) => s + p.amount_lsl, 0);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <StatCard label="Quoted" value={ev.quoted_amount ? formatCurrency(ev.quoted_amount) : "—"} />
      <StatCard label="Client offer" value={ev.client_offer ? formatCurrency(ev.client_offer) : "—"} />
      <StatCard label="Paid" value={formatCurrency(paidTotal)} accent={paidTotal > 0} />
      <StatCard label="Crowd" value={ev.crowd_size?.toLocaleString() ?? "—"} />
      <StatCard label="Event class" value={String(ev.event_class ?? "—")} />
      <StatCard label="Parties" value={String(data.parties.length)} />

      {ev.description && (
        <Card className="md:col-span-3 p-4 bg-card/40">
          <div className="text-xs text-muted-foreground mb-1">Brief</div>
          <p className="text-sm whitespace-pre-wrap">{ev.description}</p>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={"p-4 bg-card/40 " + (accent ? "border-primary/40" : "")}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg mt-1 tabular-nums">{value}</div>
    </Card>
  );
}

function TimelineTab({ entries }: { entries: Array<{ id: string; stage: string; at: string; payload: unknown }> }) {
  if (entries.length === 0) return <EmptyTab title="Timeline" hint="Nothing has happened yet." />;
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-primary/20" />
      <ul className="space-y-4">
        {entries.map((e, i) => (
          <li key={e.id} className="relative">
            <div className="absolute -left-[22px] top-1">
              {i === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              ) : (
                <Circle className="w-3 h-3 text-muted-foreground fill-background" />
              )}
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <div className="capitalize text-sm">{e.stage.replaceAll("_", " ")}</div>
              <time className="text-xs text-muted-foreground tabular-nums">
                {new Date(e.at).toLocaleString()}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatTab({ eventId, messages, onPosted }: {
  eventId: string;
  messages: Array<{ id: string; body: string; channel: string; direction: string; kind: string; created_at: string }>;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const post = useMutation({
    mutationFn: useServerFn(postMessage),
    onSuccess: () => { setBody(""); onPosted(); },
  });

  return (
    <div className="grid md:grid-cols-[1fr_auto] gap-4">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet. Start the thread.</p>
        )}
        {messages.map((m) => (
          <Card key={m.id} className="p-3 bg-card/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span className="uppercase tracking-wider">{m.channel}</span>
              <span>·</span>
              <span className="capitalize">{m.kind}</span>
              <span className="ml-auto tabular-nums">{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
          </Card>
        ))}
      </div>
      <Card className="p-3 bg-card/40 h-fit md:w-72">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Add a note</div>
        <Textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Internal note, quick log, follow-up…"
        />
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={!body.trim() || post.isPending}
          onClick={() => post.mutate({ data: { eventId, body: body.trim() } })}
        >
          Post
        </Button>
      </Card>
    </div>
  );
}

function PartiesTab({ parties }: { parties: Array<{ id: string; role: string; name: string | null; contact: unknown }> }) {
  if (parties.length === 0) return <EmptyTab title="Parties" hint="No parties attached yet." />;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {parties.map((p) => {
        const c = (p.contact as { email?: string; phone?: string; whatsapp?: string } | null) ?? {};
        return (
          <Card key={p.id} className="p-4 bg-card/40">
            <div className="text-xs uppercase tracking-wider text-primary mb-1">{p.role}</div>
            <div className="text-sm">{p.name ?? "—"}</div>
            <div className="text-xs text-muted-foreground mt-1 space-x-2">
              {c.email && <span>{c.email}</span>}
              {c.phone && <span>· {c.phone}</span>}
              {c.whatsapp && <span>· WA {c.whatsapp}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Payments tab — the 7-Day Financial Lock, end to end
// ============================================================
type PaymentRow = {
  id: string;
  kind: string;
  amount_lsl: number;
  status: string;
  method: string | null;
  created_at: string;
  hold_status?: string;
  release_reason?: string | null;
};

const STATE_META: Record<FinancialState, { label: string; dot: string; ring: string; body: string }> = {
  awaiting_deposit: { label: "🟡 Awaiting Deposit", dot: "bg-yellow-400", ring: "border-yellow-500/40", body: "50% deposit required to confirm the booking. No confirmation, logistics, campaign or artist commitment until it lands." },
  deposit_paid:     { label: "🟢 Deposit Paid",      dot: "bg-emerald-400", ring: "border-emerald-500/30", body: "Deposit received. Balance due 7 days before the event." },
  balance_pending:  { label: "🟠 Balance Pending",   dot: "bg-orange-400", ring: "border-orange-500/40", body: "Balance outstanding. Reminders auto-send at T-14 / T-7 / T-3." },
  financially_cleared: { label: "🟢 Financially Cleared", dot: "bg-emerald-500", ring: "border-emerald-500/40", body: "Full payment received. Artist fee remains held until performance is completed." },
  payment_default:  { label: "🔴 Payment Default",   dot: "bg-red-500", ring: "border-red-500/40", body: "Balance not received by the deadline. Logistics frozen. Only Management Override can continue." },
  cancelled:        { label: "⚫ Cancelled",         dot: "bg-neutral-500", ring: "border-neutral-500/40", body: "Booking cancelled by management." },
};

function PaymentsTab({ eventId, payments }: { eventId: string; payments: PaymentRow[] }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getFinancialState);
  const { data } = useQuery({
    queryKey: ["event-finance", eventId],
    queryFn: () => fetchState({ data: { eventId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["event-finance", eventId] });
    qc.invalidateQueries({ queryKey: ["event", eventId] });
  };
  const verifyM = useMutation({ mutationFn: useServerFn(verifyPayment), onSuccess: invalidate });
  const rejectM = useMutation({ mutationFn: useServerFn(rejectPayment), onSuccess: invalidate });
  const releaseM = useMutation({ mutationFn: useServerFn(releaseHold), onSuccess: invalidate });

  const s = data?.state;
  const overrides = data?.overrides ?? [];
  const meta = s ? STATE_META[s.financial_state] : null;

  return (
    <div className="space-y-6">
      {/* 1. Financial state banner */}
      {s && meta && (
        <Card className={`p-5 bg-card/40 border ${meta.ring}`}>
          <div className="flex items-start gap-4 flex-wrap">
            <span className={`w-3 h-3 rounded-full mt-2 ${meta.dot}`} />
            <div className="flex-1 min-w-[240px]">
              <div className="text-lg font-display tracking-tight">{meta.label}</div>
              <p className="text-sm text-muted-foreground mt-1">{meta.body}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-right">
              <SmallStat label="Total" value={formatCurrency(s.total_due_lsl)} />
              <SmallStat label="Paid" value={formatCurrency(s.paid_lsl)} accent={s.paid_lsl > 0} />
              <SmallStat label="Outstanding" value={formatCurrency(s.outstanding_lsl)} accent={s.outstanding_lsl > 0} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>Balance due <b className="text-foreground">{s.balance_due_on}</b></span>
            <span>·</span>
            <span>{s.days_to_balance_due >= 0 ? `${s.days_to_balance_due} days to due` : `${-s.days_to_balance_due} days overdue`}</span>
            <span>·</span>
            <span>{s.days_to_event >= 0 ? `${s.days_to_event} days to event` : "past event"}</span>
          </div>
        </Card>
      )}

      {/* 2. 7-Day Financial Lock strip */}
      {s?.lock_active && (
        <Card className="p-4 bg-red-500/5 border border-red-500/30 flex items-center gap-3">
          <Lock className="w-5 h-5 text-red-400" />
          <div className="flex-1">
            <div className="text-sm">7-Day Financial Lock engaged</div>
            <div className="text-xs text-muted-foreground">
              Once inside the seven-day window, this event is either Financially Cleared or Payment Default. No ambiguous middle state.
            </div>
          </div>
        </Card>
      )}
      {s?.financial_state === "payment_default" && !s.has_continuation && (
        <Card className="p-4 bg-red-500/10 border border-red-500/40 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <div className="flex-1 text-sm">
            Payment Default — logistics frozen. Management Override required to continue.
          </div>
        </Card>
      )}
      {s?.has_continuation && (
        <Card className="p-3 bg-emerald-500/5 border border-emerald-500/30 flex items-center gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Continuation approved — event unfrozen by management override.
        </Card>
      )}

      {/* 3. Payment ledger */}
      <section>
        <SectionHeader icon={<DollarSign className="w-4 h-4" />} title="Ledger" />
        {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded.</p>}
        <div className="space-y-2">
          {payments.map((p) => (
            <Card key={p.id} className="p-3 bg-card/40 flex items-center gap-3 text-sm flex-wrap">
              <div className="w-20 text-xs uppercase tracking-wider text-muted-foreground">{p.kind}</div>
              <div className="tabular-nums w-28">{formatCurrency(p.amount_lsl)}</div>
              <Badge className="bg-primary/10 text-primary border border-primary/20 capitalize">{p.status}</Badge>
              {p.hold_status && p.hold_status !== "released" && (
                <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 capitalize">
                  <Lock className="w-3 h-3 mr-1" /> {p.hold_status.replace("_", " ")}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                {p.status === "uploaded" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => verifyM.mutate({ data: { paymentId: p.id } })}>
                      Verify
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      const reason = window.prompt("Rejection reason?");
                      if (reason) rejectM.mutate({ data: { paymentId: p.id, reason } });
                    }}>
                      Reject
                    </Button>
                  </>
                )}
                {p.status === "verified" && p.hold_status && p.hold_status !== "released" && (
                  <Button size="sm" variant="outline" onClick={() => {
                    const reason = window.prompt("Release reason (e.g. performance completed)?");
                    if (reason) releaseM.mutate({ data: { paymentId: p.id, reason, partial: false } });
                  }}>
                    <Unlock className="w-3 h-3 mr-1" /> Release
                  </Button>
                )}
                <div className="text-xs text-muted-foreground tabular-nums">
                  {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Management Override panel */}
      <ManagementOverridePanel eventId={eventId} overrides={overrides} onDone={invalidate} defaulted={s?.financial_state === "payment_default"} />

      {/* 5. Artist Protection block */}
      <ArtistProtectionBlock payments={payments} />
    </div>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
      {icon} {title}
    </div>
  );
}

function ManagementOverridePanel({
  eventId, overrides, onDone, defaulted,
}: {
  eventId: string;
  overrides: Array<{ id: string; kind: string; reason: string; new_deadline: string | null; created_at: string; active: boolean }>;
  onDone: () => void;
  defaulted?: boolean;
}) {
  const extendM = useMutation({ mutationFn: useServerFn(extendDeadline), onSuccess: onDone });
  const contM = useMutation({ mutationFn: useServerFn(approveContinuation), onSuccess: onDone });
  const cancelM = useMutation({ mutationFn: useServerFn(cancelForNonPayment), onSuccess: onDone });

  const [newDeadline, setNewDeadline] = useState("");
  const [extendReason, setExtendReason] = useState("");
  const [contReason, setContReason] = useState("");

  return (
    <section>
      <SectionHeader icon={<ShieldAlert className="w-4 h-4" />} title="Management Override" />
      <Card className="p-4 bg-card/40 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Extend deadline</div>
            <Input type="date" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
            <Textarea rows={2} placeholder="Reason (required)" value={extendReason} onChange={(e) => setExtendReason(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!newDeadline || !extendReason.trim() || extendM.isPending}
              onClick={() => extendM.mutate({ data: { eventId, newDeadline, reason: extendReason.trim() } })}>
              Extend
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Approve continuation {defaulted ? "(required to unfreeze)" : ""}
            </div>
            <Textarea rows={2} placeholder="Reason (required)" value={contReason} onChange={(e) => setContReason(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!contReason.trim() || contM.isPending}
                onClick={() => contM.mutate({ data: { eventId, reason: contReason.trim() } })}>
                <ShieldCheck className="w-3 h-3 mr-1" /> Approve continuation
              </Button>
              <Button size="sm" variant="ghost" className="text-red-400"
                onClick={() => {
                  const r = window.prompt("Cancel reason?");
                  if (r) cancelM.mutate({ data: { eventId, reason: r } });
                }}>
                Cancel booking
              </Button>
            </div>
          </div>
        </div>

        {overrides.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Audit trail</div>
            <ul className="space-y-1 text-xs">
              {overrides.map((o) => (
                <li key={o.id} className="flex items-baseline gap-2">
                  <span className="capitalize text-foreground">{o.kind.replaceAll("_", " ")}</span>
                  {o.new_deadline && <span className="text-muted-foreground">→ {o.new_deadline}</span>}
                  <span className="text-muted-foreground">· {o.reason}</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    {new Date(o.created_at).toLocaleDateString()}
                  </span>
                  {!o.active && <span className="text-muted-foreground">(superseded)</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </section>
  );
}

function ArtistProtectionBlock({ payments }: { payments: PaymentRow[] }) {
  const held = payments.filter((p) => p.hold_status === "held" || p.hold_status === "released_partial");
  return (
    <section>
      <SectionHeader icon={<ShieldCheck className="w-4 h-4" />} title="Artist Protection" />
      <Card className="p-4 bg-card/40 text-sm space-y-2">
        <p className="text-xs text-muted-foreground">
          Performance fee is held until the event is completed. Approved logistics costs (travel, hotel) can be released separately.
        </p>
        {held.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No held payments.</p>
        ) : (
          <ul className="space-y-1">
            {held.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-xs">
                <Lock className="w-3 h-3 text-yellow-400" />
                <span className="uppercase tracking-wider">{p.kind}</span>
                <span className="tabular-nums">{formatCurrency(p.amount_lsl)}</span>
                <span className="text-muted-foreground">· {p.hold_status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function TravelTab({ logistics }: { logistics: { travel?: unknown; hotel?: unknown; driver?: unknown; distance_km?: number | null } | null }) {
  if (!logistics) return <EmptyTab title="Travel" hint="No logistics captured yet." />;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <StatCard label="Distance" value={logistics.distance_km ? `${logistics.distance_km} km` : "—"} />
      <Card className="p-4 bg-card/40">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Travel</div>
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(logistics.travel ?? {}, null, 2)}</pre>
      </Card>
    </div>
  );
}

function CampaignTab({ campaign }: { campaign: Array<{ id: string; phase: string; scheduled_at: string | null; status: string; channel: string }> }) {
  if (campaign.length === 0) {
    return <EmptyTab title="Campaign" hint="Confirmed events auto-schedule T-30 / T-14 / T-7 / T-1 / Thank-you. Runner wires next." />;
  }
  return (
    <div className="space-y-2">
      {campaign.map((c) => (
        <Card key={c.id} className="p-3 bg-card/40 flex items-center gap-3 text-sm">
          <div className="w-28 text-xs uppercase tracking-wider text-primary">{c.phase}</div>
          <div className="text-xs text-muted-foreground">{c.channel}</div>
          <Badge className="ml-2 bg-primary/10 text-primary border border-primary/20 capitalize">{c.status}</Badge>
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "—"}
          </div>
        </Card>
      ))}
    </div>
  );
}

function TasksTab({ tasks }: { tasks: Array<{ id: string; title: string; status: string; due_at: string | null }> }) {
  if (tasks.length === 0) return <EmptyTab title="Tasks" hint="No tasks yet." />;
  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <Card key={t.id} className="p-3 bg-card/40 flex items-center gap-3 text-sm">
          <div className="flex-1">{t.title}</div>
          <Badge className="bg-primary/10 text-primary border border-primary/20 capitalize">{t.status}</Badge>
          {t.due_at && (
            <div className="text-xs text-muted-foreground tabular-nums">{new Date(t.due_at).toLocaleDateString()}</div>
          )}
        </Card>
      ))}
    </div>
  );
}

function DocumentsTab({ documents }: { documents: Array<{ id: string; kind: string; filename: string; created_at: string }> }) {
  if (documents.length === 0) return <EmptyTab title="Documents" hint="Quotes, contracts, invoices, call sheets and POPs land here." />;
  return (
    <div className="space-y-2">
      {documents.map((d) => (
        <Card key={d.id} className="p-3 bg-card/40 flex items-center gap-3 text-sm">
          <div className="w-24 text-xs uppercase tracking-wider text-primary">{d.kind}</div>
          <div>{d.filename}</div>
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            {new Date(d.created_at).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyTab({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="p-8 bg-card/40 border-dashed">
      <div className="text-sm uppercase tracking-wider text-muted-foreground">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </Card>
  );
}

// Silence unused warning for Link (kept for future header links)
void Link;
