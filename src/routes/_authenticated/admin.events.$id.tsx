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
  LayoutGrid, Users, ShieldAlert, ShieldCheck, Lock, Unlock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/events/$id")({
  component: EventWorkspace,
});

type TabId =
  | "overview" | "timeline" | "chat" | "payments" | "contracts"
  | "travel" | "campaign" | "media" | "documents" | "tasks" | "analytics" | "parties";

const TABS: { id: TabId; label: string; Icon: typeof Circle }[] = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
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

function PaymentsTab({ payments }: { payments: Array<{ id: string; kind: string; amount_lsl: number; status: string; method: string | null; created_at: string }> }) {
  if (payments.length === 0) return <EmptyTab title="Payments" hint="No payments yet." />;
  return (
    <div className="space-y-2">
      {payments.map((p) => (
        <Card key={p.id} className="p-3 bg-card/40 flex items-center gap-3 text-sm">
          <div className="w-24 text-xs uppercase tracking-wider text-muted-foreground">{p.kind}</div>
          <div className="tabular-nums">{formatCurrency(p.amount_lsl)}</div>
          <Badge className="ml-2 bg-primary/10 text-primary border border-primary/20 capitalize">{p.status}</Badge>
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            {new Date(p.created_at).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
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
