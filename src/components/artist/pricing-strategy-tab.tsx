// Pricing Strategy tab — flexible per-scenario rates + monthly goal.
// Advisory only. All prices display with a currency code.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getPricingStrategy,
  updatePricingStrategy,
  type PricingStrategyInput,
} from "@/lib/artists/pricing.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Info } from "lucide-react";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function centsToInput(v: number | null | undefined): string {
  if (v == null) return "";
  return (v / 100).toString();
}
function inputToCents(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function PricingStrategyTab() {
  const load = useServerFn(getPricingStrategy);
  const save = useServerFn(updatePricingStrategy);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pricing-strategy"],
    queryFn: () => load(),
  });

  const p = data?.pricing ?? null;
  const currency = p?.currency ?? "ZAR";

  const [form, setForm] = useState({
    standard: "",
    dream: "",
    minimum: "",
    growth: "",
    growthPct: "",
    growthEnabled: false,
    weekday: "",
    weekdayDays: [] as number[],
    weekdayEnabled: false,
    lastMinutePct: "",
    lastMinuteEnabled: false,
    lastMinuteWindow: "7",
    tour: "",
    tourRadius: "",
    tourExtra: "",
    tourEnabled: false,
    goal: "",
    opportunityMode: false,
  });

  useEffect(() => {
    if (!p) return;
    setForm({
      standard: centsToInput(p.standard_price_cents),
      dream: centsToInput(p.dream_price_cents),
      minimum: centsToInput(p.minimum_price_cents),
      growth: centsToInput(p.growth_price_cents),
      growthPct: p.growth_price_pct?.toString() ?? "",
      growthEnabled: !!p.growth_price_enabled,
      weekday: centsToInput(p.weekday_price_cents),
      weekdayDays: p.weekday_price_days ?? [],
      weekdayEnabled: !!p.weekday_price_enabled,
      lastMinutePct: p.last_minute_discount_pct?.toString() ?? "",
      lastMinuteEnabled: !!p.last_minute_enabled,
      lastMinuteWindow: (p.last_minute_window_days ?? 7).toString(),
      tour: centsToInput(p.tour_price_cents),
      tourRadius: p.tour_radius_km?.toString() ?? "",
      tourExtra: p.tour_max_extra_km?.toString() ?? "",
      tourEnabled: !!p.tour_price_enabled,
      goal: centsToInput(p.monthly_income_goal_cents),
      opportunityMode: !!p.opportunity_mode_enabled,
    });
  }, [p]);

  const mut = useMutation({
    mutationFn: (input: PricingStrategyInput) => save({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-strategy"] });
      qc.invalidateQueries({ queryKey: ["career-rollup"] });
      toast.success("Pricing strategy saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;

  function submit() {
    const std = inputToCents(form.standard);
    const min = inputToCents(form.minimum);
    const dream = inputToCents(form.dream);
    if (min != null && std != null && min > std) {
      toast.warning("Minimum is higher than your standard rate. You can still save.");
    }
    if (dream != null && std != null && dream < std) {
      toast.warning("Dream price is below your standard rate. You can still save.");
    }
    mut.mutate({
      standard_price_cents: std,
      dream_price_cents: dream,
      minimum_price_cents: min,
      growth_price_cents: inputToCents(form.growth),
      growth_price_pct: form.growthPct ? Number(form.growthPct) : null,
      growth_price_enabled: form.growthEnabled,
      weekday_price_cents: inputToCents(form.weekday),
      weekday_price_days: form.weekdayDays,
      weekday_price_enabled: form.weekdayEnabled,
      last_minute_discount_pct: form.lastMinutePct ? Number(form.lastMinutePct) : null,
      last_minute_enabled: form.lastMinuteEnabled,
      last_minute_window_days: Number(form.lastMinuteWindow) || 7,
      tour_price_cents: inputToCents(form.tour),
      tour_radius_km: form.tourRadius ? Number(form.tourRadius) : null,
      tour_max_extra_km: form.tourExtra ? Number(form.tourExtra) : null,
      tour_price_enabled: form.tourEnabled,
      monthly_income_goal_cents: inputToCents(form.goal),
      monthly_goal_currency: currency,
      opportunity_mode_enabled: form.opportunityMode,
    });
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      weekdayDays: f.weekdayDays.includes(d)
        ? f.weekdayDays.filter((x) => x !== d)
        : [...f.weekdayDays, d].sort(),
    }));
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex items-start gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-primary mt-0.5" />
          <p className="text-muted-foreground">
            These rates guide quotes and recommendations. Penya Play never auto-changes your price
            — you decide.
          </p>
        </div>
      </Card>

      {/* Standard */}
      <PriceRow
        label="Standard Booking Price"
        badge="Default rate"
        hint="Your normal professional rate. This is the default shown on your Booking Button."
        currency={currency}
        value={form.standard}
        onChange={(v) => setForm({ ...form, standard: v })}
      />

      {/* Dream */}
      <PriceRow
        label="Dream Price"
        badge="Never auto-quoted"
        hint="What you'd ideally like to earn when demand is high. Stored for future goals — never auto-applied."
        currency={currency}
        value={form.dream}
        onChange={(v) => setForm({ ...form, dream: v })}
      />

      {/* Minimum */}
      <PriceRow
        label="Minimum Acceptable Price"
        badge="Recommendations never go below"
        hint="The lowest fee you'd comfortably accept. You can still override manually."
        currency={currency}
        value={form.minimum}
        onChange={(v) => setForm({ ...form, minimum: v })}
      />

      {/* Growth */}
      <SectionCard
        title="Growth Price (hunting price)"
        subtitle="Internal only — never shown publicly."
        enabled={form.growthEnabled}
        onToggle={(v) => setForm({ ...form, growthEnabled: v })}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Fixed amount</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10">{currency}</span>
              <Input
                type="number"
                min={0}
                value={form.growth}
                onChange={(e) => setForm({ ...form, growth: e.target.value })}
                placeholder="e.g. 15000"
              />
            </div>
          </div>
          <div>
            <Label>Or discount %</Label>
            <Input
              type="number"
              min={0}
              max={90}
              value={form.growthPct}
              onChange={(e) => setForm({ ...form, growthPct: e.target.value })}
              placeholder="e.g. 20"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Would you accept a lower fee to enter a new city, venue or market?
        </p>
      </SectionCard>

      {/* Weekday */}
      <SectionCard
        title="Weekday Price"
        subtitle="Different rate for specific weekdays. Weekend pricing stays separate."
        enabled={form.weekdayEnabled}
        onToggle={(v) => setForm({ ...form, weekdayEnabled: v })}
      >
        <div>
          <Label>Weekday rate</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10">{currency}</span>
            <Input
              type="number"
              min={0}
              value={form.weekday}
              onChange={(e) => setForm({ ...form, weekday: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3">
          <Label>Applies to</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {DOW.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`px-3 py-1 rounded-full text-xs border ${
                  form.weekdayDays.includes(i)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Last-minute */}
      <SectionCard
        title="Last-Minute Booking Discount"
        subtitle="Applies only when your weekend is open inside the window."
        enabled={form.lastMinuteEnabled}
        onToggle={(v) => setForm({ ...form, lastMinuteEnabled: v })}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Discount %</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[5, 10, 15].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, lastMinutePct: n.toString() })}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    form.lastMinutePct === n.toString()
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {n}%
                </button>
              ))}
              <Input
                className="w-24"
                type="number"
                min={0}
                max={90}
                value={form.lastMinutePct}
                onChange={(e) => setForm({ ...form, lastMinutePct: e.target.value })}
                placeholder="custom"
              />
            </div>
          </div>
          <div>
            <Label>Window (days out)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={form.lastMinuteWindow}
              onChange={(e) => setForm({ ...form, lastMinuteWindow: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>

      {/* Touring */}
      <SectionCard
        title="Touring Price"
        subtitle="If you're already travelling nearby, would you accept a lower fee?"
        enabled={form.tourEnabled}
        onToggle={(v) => setForm({ ...form, tourEnabled: v })}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Tour rate</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10">{currency}</span>
              <Input
                type="number"
                min={0}
                value={form.tour}
                onChange={(e) => setForm({ ...form, tour: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Travel radius (km)</Label>
            <Input
              type="number"
              min={0}
              value={form.tourRadius}
              onChange={(e) => setForm({ ...form, tourRadius: e.target.value })}
            />
          </div>
          <div>
            <Label>Max extra distance (km)</Label>
            <Input
              type="number"
              min={0}
              value={form.tourExtra}
              onChange={(e) => setForm({ ...form, tourExtra: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>

      {/* Monthly goal */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="font-medium text-sm">Monthly Income Goal</div>
            <p className="text-xs text-muted-foreground mt-1">
              How much would you like to earn each month from performances? Progress is measured
              against confirmed bookings only — no forecasts.
            </p>
            <div className="mt-3 flex items-center gap-2 max-w-xs">
              <span className="text-xs text-muted-foreground w-10">{currency}</span>
              <Input
                type="number"
                min={0}
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="e.g. 50000"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Opportunity mode */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium text-sm">Opportunity Mode</div>
              <Badge variant="secondary" className="text-[10px]">Opt-in</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              When enabled, Penya Play prioritises showing you suitable opportunities during periods
              when your calendar is relatively open.
            </p>
          </div>
          <Switch
            checked={form.opportunityMode}
            onCheckedChange={(v) => setForm({ ...form, opportunityMode: v })}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
          All prices are stored with a currency code ({currency}). No AI changes your price.
        </div>
        <Button onClick={submit} disabled={mut.isPending}>
          {mut.isPending ? "Saving…" : "Save pricing strategy"}
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium text-sm">{title}</div>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && <div className="mt-4">{children}</div>}
    </Card>
  );
}

function PriceRow({
  label,
  badge,
  hint,
  currency,
  value,
  onChange,
}: {
  label: string;
  badge: string;
  hint: string;
  currency: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium text-sm">{label}</div>
            <Badge variant="outline" className="text-[10px]">
              {badge}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>
        <div className="flex items-center gap-2 min-w-[220px]">
          <span className="text-xs text-muted-foreground w-10">{currency}</span>
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
    </Card>
  );
}
