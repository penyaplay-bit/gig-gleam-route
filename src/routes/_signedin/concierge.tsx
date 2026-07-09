// 6-step Concierge Wizard — captures a booking intent for the signed-in user.
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Sparkles, MapPin, DollarSign, Filter, ListChecks, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { tenant, type OpportunityCategory, type GeoScope } from "@/lib/engine/tenant";
import { SADC_COUNTRIES, OTHER_AFRICA } from "@/lib/africa-locations";
import { saveBookingIntent, getMyBookingIntent } from "@/lib/engine/intents.functions";

export const Route = createFileRoute("/_signedin/concierge")({
  head: () => ({
    meta: [
      { title: "AI Concierge — Penya Play" },
      { name: "description", content: "Tell Penya Play what bookings you want. The AI concierge builds your intent profile so we can match, discover, and pitch on your behalf." },
    ],
  }),
  component: ConciergePage,
});

type WizardState = {
  who: "self" | "roster";
  categories: OpportunityCategory[];
  fee_min: number | null;
  fee_max: number | null;
  min_acceptable: number | null;
  fee_currency: string;
  primary_territory: string;
  additional_territories: string[];
  travel_ok: boolean;
  filters: string[];
};

const STEPS = [
  { id: 1, label: "Who", Icon: User },
  { id: 2, label: "Booking types", Icon: ListChecks },
  { id: 3, label: "Fee", Icon: DollarSign },
  { id: 4, label: "Territory", Icon: MapPin },
  { id: 5, label: "Availability", Icon: Sparkles },
  { id: 6, label: "Preferences", Icon: Filter },
] as const;

const ALL_COUNTRIES = [...SADC_COUNTRIES, ...OTHER_AFRICA];

function ConciergePage() {
  const navigate = useNavigate();
  const loadIntent = useServerFn(getMyBookingIntent);
  const saveIntent = useServerFn(saveBookingIntent);

  const existing = useQuery({
    queryKey: ["booking-intent", "mine"],
    queryFn: () => loadIntent(),
  });

  const [step, setStep] = useState(1);
  const [s, setS] = useState<WizardState>({
    who: "self",
    categories: [],
    fee_min: null,
    fee_max: null,
    min_acceptable: null,
    fee_currency: "ZAR",
    primary_territory: "Lesotho",
    additional_territories: [],
    travel_ok: false,
    filters: [],
  });

  // Hydrate from existing intent once loaded.
  useEffect(() => {
    const i = existing.data?.intent;
    if (!i) return;
    setS((prev) => ({
      ...prev,
      categories: (i.categories as OpportunityCategory[]) ?? [],
      fee_min: i.fee_min,
      fee_max: i.fee_max,
      min_acceptable: i.min_acceptable,
      fee_currency: i.fee_currency ?? "ZAR",
      primary_territory: i.primary_territory ?? "Lesotho",
      additional_territories: i.additional_territories ?? [],
      travel_ok: i.travel_ok ?? false,
      filters: Array.isArray((i.filters_json as any)?.preferences)
        ? ((i.filters_json as any).preferences as string[])
        : [],
    }));
  }, [existing.data?.intent?.id]);

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof saveIntent>[0]) => saveIntent(payload),
    onSuccess: () => {
      toast.success("Concierge profile saved. Building your feed…");
      navigate({ to: "/find-gigs" as never });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save intent"),
  });

  const canNext = useMemo(() => {
    if (step === 2) return s.categories.length > 0;
    if (step === 4) return !!s.primary_territory;
    return true;
  }, [step, s]);

  function next() {
    if (step < 6) setStep((n) => n + 1);
    else submit();
  }

  function submit() {
    save.mutate({
      data: {
        roles: s.who === "roster" ? ["manager"] : ["artist"],
        categories: s.categories,
        fee_min: s.fee_min,
        fee_max: s.fee_max,
        min_acceptable: s.min_acceptable,
        fee_currency: s.fee_currency,
        primary_territory: s.primary_territory,
        additional_territories: s.additional_territories,
        travel_ok: s.travel_ok,
        filters_json: { preferences: s.filters },
      },
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest">
          <Sparkles className="w-3.5 h-3.5" /> AI Concierge
        </div>
        <h1 className="font-display text-3xl md:text-4xl">Build your booking intent</h1>
        <p className="text-muted-foreground text-sm">Six quick steps. Penya Play uses this to match verified gigs and pitch you into discovered opportunities.</p>
      </header>

      {/* Stepper */}
      <ol className="grid grid-cols-6 gap-1">
        {STEPS.map(({ id, label, Icon }) => {
          const done = step > id;
          const active = step === id;
          return (
            <li key={id} className={`rounded-md border px-2 py-2 text-[10px] md:text-xs flex flex-col items-center gap-1 ${active ? "border-primary bg-primary/10 text-foreground" : done ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}>
              <Icon className="w-4 h-4" />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{id}</span>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border border-border bg-card/70 backdrop-blur p-5 md:p-8 min-h-[320px]">
        {step === 1 && <StepWho state={s} setState={setS} />}
        {step === 2 && <StepCategories state={s} setState={setS} />}
        {step === 3 && <StepFee state={s} setState={setS} />}
        {step === 4 && <StepTerritory state={s} setState={setS} />}
        {step === 5 && <StepAvailability />}
        {step === 6 && <StepPreferences state={s} setState={setS} />}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : navigate({ to: "/find-gigs" as never })}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {step > 1 ? "Back" : "Cancel"}
        </Button>
        <div className="flex gap-2">
          {step < 6 && (
            <Button variant="ghost" onClick={() => submit()} disabled={save.isPending || s.categories.length === 0}>
              Save & finish later
            </Button>
          )}
          <Button onClick={next} disabled={!canNext || save.isPending}>
            {step < 6 ? (
              <>Next <ArrowRight className="w-4 h-4 ml-1" /></>
            ) : (
              <>{save.isPending ? "Saving…" : "Finish"} <Check className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Steps ----------

function StepWho({ state, setState }: { state: WizardState; setState: (fn: (s: WizardState) => WizardState) => void }) {
  const options: { v: WizardState["who"]; title: string; body: string }[] = [
    { v: "self", title: "For myself", body: "I'm an artist setting up my own booking intent." },
    { v: "roster", title: "For a roster artist", body: "I'm a manager — I'll build one intent per artist on my roster." },
  ];
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Who is this for?</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => setState((s) => ({ ...s, who: o.v }))}
            className={`text-left rounded-lg border p-4 transition ${state.who === o.v ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
          >
            <div className="font-semibold">{o.title}</div>
            <div className="text-sm text-muted-foreground mt-1">{o.body}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepCategories({ state, setState }: { state: WizardState; setState: (fn: (s: WizardState) => WizardState) => void }) {
  function toggle(v: OpportunityCategory) {
    setState((s) => ({
      ...s,
      categories: s.categories.includes(v) ? s.categories.filter((x) => x !== v) : [...s.categories, v],
    }));
  }
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">What kind of bookings?</h2>
      <p className="text-sm text-muted-foreground">Pick every category that fits — the more you pick, the wider the feed.</p>
      <div className="flex flex-wrap gap-2">
        {tenant.categories.map((c) => {
          const on = state.categories.includes(c.value);
          return (
            <button
              key={c.value}
              onClick={() => toggle(c.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepFee({ state, setState }: { state: WizardState; setState: (fn: (s: WizardState) => WizardState) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl">Fee expectations</h2>
      <p className="text-sm text-muted-foreground">Quick ranges — you can override with custom values below.</p>
      <div className="flex flex-wrap gap-2">
        {tenant.quickFeeRanges.map((r) => {
          const on = state.fee_min === r.min && state.fee_max === r.max;
          return (
            <button
              key={r.label}
              onClick={() => setState((s) => ({ ...s, fee_min: r.min, fee_max: r.max }))}
              className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Min fee</span>
          <Input type="number" min={0} value={state.fee_min ?? ""} onChange={(e) => setState((s) => ({ ...s, fee_min: e.target.value ? Number(e.target.value) : null }))} />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Max fee</span>
          <Input type="number" min={0} value={state.fee_max ?? ""} onChange={(e) => setState((s) => ({ ...s, fee_max: e.target.value ? Number(e.target.value) : null }))} />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Min acceptable</span>
          <Input type="number" min={0} value={state.min_acceptable ?? ""} onChange={(e) => setState((s) => ({ ...s, min_acceptable: e.target.value ? Number(e.target.value) : null }))} />
        </label>
      </div>
      <label className="text-sm space-y-1 max-w-[160px]">
        <span className="text-muted-foreground">Currency</span>
        <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm" value={state.fee_currency} onChange={(e) => setState((s) => ({ ...s, fee_currency: e.target.value }))}>
          {["ZAR","LSL","USD","EUR","GBP","BWP","NAD"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    </div>
  );
}

function StepTerritory({ state, setState }: { state: WizardState; setState: (fn: (s: WizardState) => WizardState) => void }) {
  const primary = state.primary_territory;
  const additional = state.additional_territories;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl">Where do you want to perform?</h2>
        <p className="text-sm text-muted-foreground">Start with a primary territory. Add others — the AI prioritizes the primary but scans all selected.</p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Primary territory</div>
        <div className="flex flex-wrap gap-2">
          {SADC_COUNTRIES.slice(0, 8).map((c) => {
            const on = primary === c.name;
            return (
              <button
                key={c.name}
                onClick={() => setState((s) => ({ ...s, primary_territory: c.name, additional_territories: s.additional_territories.filter((x) => x !== c.name) }))}
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <select
          className="mt-3 w-full md:w-72 h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={ALL_COUNTRIES.some((c) => c.name === primary) ? primary : ""}
          onChange={(e) => setState((s) => ({ ...s, primary_territory: e.target.value, additional_territories: s.additional_territories.filter((x) => x !== e.target.value) }))}
        >
          <option value="">— pick another country —</option>
          {ALL_COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Additional territories</div>
        <div className="flex flex-wrap gap-2">
          {ALL_COUNTRIES.filter((c) => c.name !== primary).slice(0, 20).map((c) => {
            const on = additional.includes(c.name);
            return (
              <button
                key={c.name}
                onClick={() => setState((s) => ({
                  ...s,
                  additional_territories: on ? s.additional_territories.filter((x) => x !== c.name) : [...s.additional_territories, c.name],
                }))}
                className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary/70 bg-primary/20 text-foreground" : "border-border hover:border-primary/40"}`}
              >
                {on ? "✓ " : "+ "}{c.name}
              </button>
            );
          })}
        </div>
        {additional.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {additional.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
          </div>
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.travel_ok}
          onChange={(e) => setState((s) => ({ ...s, travel_ok: e.target.checked }))}
          className="h-4 w-4 accent-primary"
        />
        Willing to travel outside selected territories if travel & accommodation are covered
      </label>
    </div>
  );
}

function StepAvailability() {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Availability</h2>
      <p className="text-sm text-muted-foreground">You'll manage your calendar in the Availability editor. For now, we assume you're open unless you mark dates busy.</p>
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center text-sm text-muted-foreground">
        <Sparkles className="w-5 h-5 mx-auto mb-2 text-primary" />
        Calendar editor ships in the next slice. Continue for now — your intent will still match on category, fee and territory.
      </div>
    </div>
  );
}

function StepPreferences({ state, setState }: { state: WizardState; setState: (fn: (s: WizardState) => WizardState) => void }) {
  function toggle(id: string) {
    setState((s) => ({
      ...s,
      filters: s.filters.includes(id) ? s.filters.filter((x) => x !== id) : [...s.filters, id],
    }));
  }
  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Preferences</h2>
      <p className="text-sm text-muted-foreground">Optional filters — the AI weights these when ranking your feed.</p>
      <div className="flex flex-wrap gap-2">
        {tenant.preferenceFilters.map((f) => {
          const on = state.filters.includes(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4 text-sm text-muted-foreground">
        Ready? Hit <span className="text-foreground font-semibold">Finish</span> — we'll build your ranked feed of verified and discovered opportunities.
      </div>
    </div>
  );
}
