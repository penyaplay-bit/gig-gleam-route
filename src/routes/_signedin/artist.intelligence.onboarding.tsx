// Artist Intelligence onboarding — the "Career Map" wizard.
// Ships the highest-value step first: performance history capture with search-or-create
// for venues + promoters, plus CSV paste for bulk import.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Upload, ArrowRight, CheckCircle2, Sparkles, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listPerformances, upsertPerformance, deletePerformance, searchVenues, createVenue,
  type PerformanceInput,
} from "@/lib/intel/performances.functions";

export const Route = createFileRoute("/_signedin/artist/intelligence/onboarding")({
  head: () => ({
    meta: [
      { title: "Career mapping — Penya Play" },
      { name: "description", content: "Map every show you've performed so Penya Play can find your highest-value opportunities." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingWizard,
});

const EVENT_TYPES = [
  "festival","club","corporate","wedding","government","private","university","tv","radio","brand","other",
] as const;

type Draft = Partial<PerformanceInput> & { event_name: string; event_date: string };

const emptyDraft = (): Draft => ({
  event_name: "",
  event_date: new Date().toISOString().slice(0, 10),
  event_type: "other",
  headliner_bool: false,
  fee_currency: "ZAR",
  proof_urls: [],
});

function OnboardingWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const load = useServerFn(listPerformances);
  const upsert = useServerFn(upsertPerformance);
  const del = useServerFn(deletePerformance);

  const { data } = useQuery({ queryKey: ["performances"], queryFn: () => load() });
  const perfs = data?.performances ?? [];

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const save = useMutation({
    mutationFn: (d: PerformanceInput) => upsert({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["performances"] });
      qc.invalidateQueries({ queryKey: ["artist-intel"] });
      setDraft(emptyDraft());
      toast.success("Performance added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["performances"] });
      qc.invalidateQueries({ queryKey: ["artist-intel"] });
      toast.success("Removed");
    },
  });

  function handleAdd() {
    if (!draft.event_name.trim() || !draft.event_date) {
      toast.error("Event name and date are required");
      return;
    }
    save.mutate(draft as PerformanceInput);
  }

  function handleBulkPaste() {
    const rows = pasteText.trim().split(/\r?\n/).filter(Boolean);
    if (rows.length === 0) return;
    // Format: date, event_name, venue, city, country, event_type, crowd
    let ok = 0;
    for (const row of rows) {
      const cols = row.split(/\s*,\s*/);
      const [date, event_name, venue, city, country, type, crowd] = cols;
      if (!date || !event_name) continue;
      save.mutate({
        event_name,
        event_date: date,
        venue_name: venue || null,
        city: city || null,
        country: country || null,
        event_type: (EVENT_TYPES.includes(type as never) ? type : "other") as PerformanceInput["event_type"],
        crowd_est: crowd ? Number(crowd) : null,
        headliner_bool: false,
        fee_currency: "ZAR",
        proof_urls: [],
      } as PerformanceInput);
      ok++;
    }
    setPasteText("");
    setPasteMode(false);
    toast.success(`Queued ${ok} performances`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-primary text-sm mb-1">
          <Sparkles className="w-4 h-4" /> Career mapping
        </div>
        <h1 className="text-2xl md:text-3xl font-display">Tell us where you've performed</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Every show you log — even before Penya Play — teaches the engine your fanbase heat map, venue relationships, and touring corridors. Fee and notes stay private to you.
        </p>
      </div>

      {/* Add form */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Add a performance</h2>
          <Button variant="ghost" size="sm" onClick={() => setPasteMode(v => !v)}>
            <ClipboardPaste className="w-4 h-4 mr-1" />
            {pasteMode ? "Cancel bulk" : "Bulk paste"}
          </Button>
        </div>

        {pasteMode ? (
          <div className="space-y-3">
            <Label>One show per line: date, event name, venue, city, country, type, crowd</Label>
            <Textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"2024-11-15, MTN Bushfire, House on Fire, Malkerns, Eswatini, festival, 12000\n2024-10-05, Basotho Heritage Fest, Setsoto Stadium, Maseru, Lesotho, festival, 8000"}
            />
            <Button onClick={handleBulkPaste} disabled={!pasteText.trim()}>
              <Upload className="w-4 h-4 mr-1" /> Import
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Event name *">
              <Input value={draft.event_name} onChange={(e) => setDraft({ ...draft, event_name: e.target.value })} placeholder="MTN Bushfire" />
            </Field>
            <Field label="Date *">
              <Input type="date" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} />
            </Field>
            <Field label="Venue">
              <VenuePicker
                value={draft.venue_name ?? ""}
                onSelect={(name, city, country) => setDraft({
                  ...draft, venue_name: name,
                  city: draft.city || city || null,
                  country: draft.country || country || null,
                })}
              />
            </Field>
            <Field label="Event type">
              <Select value={draft.event_type ?? "other"} onValueChange={(v) => setDraft({ ...draft, event_type: v as PerformanceInput["event_type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="City">
              <Input value={draft.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Maseru" />
            </Field>
            <Field label="Country">
              <Input value={draft.country ?? ""} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="Lesotho" />
            </Field>
            <Field label="Crowd size (approx.)">
              <Input type="number" min={0} value={draft.crowd_est ?? ""} onChange={(e) => setDraft({ ...draft, crowd_est: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Promoter">
              <Input value={draft.promoter_name ?? ""} onChange={(e) => setDraft({ ...draft, promoter_name: e.target.value })} placeholder="ABC Promotions" />
            </Field>
            <Field label="Booking fee (private)">
              <Input type="number" min={0} value={draft.fee_private ?? ""} onChange={(e) => setDraft({ ...draft, fee_private: e.target.value ? Number(e.target.value) : null })} placeholder="ZAR" />
            </Field>
            <Field label="Role">
              <div className="flex gap-2 items-center h-10">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.headliner_bool ?? false}
                    onChange={(e) => setDraft({ ...draft, headliner_bool: e.target.checked })}
                  />
                  Headliner
                </label>
              </div>
            </Field>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleAdd} disabled={save.isPending}>
                <Plus className="w-4 h-4 mr-1" /> Add performance
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* List */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Your performances ({perfs.length})</h2>
          {perfs.length > 0 && (
            <Button asChild size="sm">
              <Link to="/artist/intelligence">
                See my Career Map <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          )}
        </div>
        {perfs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No performances yet. Add your first above.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {perfs.map((p) => (
              <li key={p.id} className="py-3 flex items-start justify-between gap-4">
                <div className="text-sm">
                  <div className="font-medium">
                    {p.event_name}
                    {p.headliner_bool && <Badge variant="secondary" className="ml-2">Headliner</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.event_date} · {p.venue_name ?? "—"}{p.city ? ` · ${p.city}` : ""}{p.country ? `, ${p.country}` : ""}
                    {p.crowd_est ? ` · ${p.crowd_est.toLocaleString()}` : ""}
                    {" · "}<span className="capitalize">{p.event_type}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {perfs.length >= 3 && (
        <Card className="p-5 border-green-500/30 bg-green-500/5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Career map ready</div>
              <p className="text-sm text-muted-foreground mt-1">
                You've logged enough shows to power your fanbase heat map and touring corridors.
              </p>
              <Button asChild className="mt-3">
                <Link to="/artist/intelligence">Open my dashboard</Link>
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function VenuePicker({
  value, onSelect,
}: {
  value: string;
  onSelect: (name: string, city?: string, country?: string) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const search = useServerFn(searchVenues);
  const create = useServerFn(createVenue);

  const { data } = useQuery({
    queryKey: ["venue-search", q],
    queryFn: () => search({ data: { q } }),
    enabled: open && q.length >= 2,
  });

  const results = data?.venues ?? [];
  const exactMatch = useMemo(() => results.some(r => r.name.toLowerCase() === q.trim().toLowerCase()), [results, q]);

  async function handleCreate() {
    const name = q.trim();
    if (!name) return;
    try {
      const { venue } = await create({ data: { name } });
      onSelect(venue.name, venue.city ?? undefined, venue.country ?? undefined);
      setOpen(false);
    } catch (e) {
      // Fall back to just using the name locally
      onSelect(name);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search or add venue"
      />
      {open && q.length >= 2 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-y-auto">
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(r.name, r.city ?? undefined, r.country ?? undefined); setQ(r.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
            >
              <div className="font-medium">{r.name}</div>
              {(r.city || r.country) && (
                <div className="text-xs text-muted-foreground">{[r.city, r.country].filter(Boolean).join(", ")}</div>
              )}
            </button>
          ))}
          {!exactMatch && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-t border-border/40 text-primary"
            >
              <Plus className="w-3 h-3 inline mr-1" /> Add "{q}" as new venue
            </button>
          )}
        </div>
      )}
    </div>
  );
}
