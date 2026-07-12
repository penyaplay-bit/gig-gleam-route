// Career dashboard — real data only. No forecasts, no fake stats.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCareerRollup } from "@/lib/artists/pricing.functions";
import { deriveSuggestions, type Suggestion } from "@/lib/pricing/suggestions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarCheck2, MapPin, Repeat, Coins, Sparkles, Lightbulb, Target } from "lucide-react";

export const Route = createFileRoute("/_signedin/artist/career")({
  head: () => ({
    meta: [
      { title: "Career dashboard — Penya Play" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CareerDashboard,
});

function fmt(cents: number | null | undefined, currency = "ZAR") {
  if (cents == null) return "—";
  const val = cents / 100;
  return `${currency} ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function CareerDashboard() {
  const load = useServerFn(getCareerRollup);
  const { data, isLoading } = useQuery({
    queryKey: ["career-rollup"],
    queryFn: () => load(),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  const profile = data.profile;
  const counts = data.counts;
  const currency = profile?.monthly_goal_currency ?? "ZAR";
  const goal = profile?.monthly_income_goal_cents ?? null;
  const monthFees = data.monthFeesCents;
  const goalPct = goal && goal > 0 ? Math.min(100, Math.round((monthFees / goal) * 100)) : 0;

  const suggestions: Suggestion[] = deriveSuggestions(
    profile
      ? {
          standard_price_cents: profile.standard_price_cents,
          weekday_price_enabled: profile.weekday_price_enabled,
          growth_price_enabled: profile.growth_price_enabled,
          last_minute_enabled: profile.last_minute_enabled,
          tour_price_enabled: profile.tour_price_enabled,
          currency: currency,
        }
      : null,
    (data.performances ?? []).map((p) => ({
      event_date: p.event_date,
      city: p.city ?? null,
      fee_private: (p.fee_private as number | null) ?? null,
      status: p.status ?? "confirmed",
    })),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-sm mb-1">
            <Sparkles className="w-4 h-4" /> Career dashboard
          </div>
          <h1 className="text-2xl md:text-3xl font-display">Your booking business</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Only real, confirmed data is shown. More insights appear as you complete more performances.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/artist/intelligence/onboarding">Add a performance</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/artist/profile" search={{ tab: "pricing" } as never}>
              Pricing strategy
            </Link>
          </Button>
        </div>
      </header>

      {/* Monthly goal */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Target className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium">Monthly income goal</h2>
              {profile?.opportunity_mode_enabled && (
                <Badge variant="secondary" className="text-[10px]">Opportunity mode on</Badge>
              )}
            </div>
            {goal ? (
              <>
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <span className="font-mono">{fmt(monthFees, currency)}</span>
                  <span className="text-muted-foreground">of {fmt(goal, currency)}</span>
                </div>
                <Progress value={goalPct} className="mt-2 h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Based on confirmed performances this month. Off-platform gigs you log count too.
                </p>
              </>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                Set a monthly goal on the{" "}
                <Link to="/artist/profile" className="text-primary underline">
                  Pricing strategy
                </Link>{" "}
                tab to track progress.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.map((s) => (
            <Card key={s.id} className="p-4 border-primary/30 bg-primary/5">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{s.title}</div>
                  <p className="text-xs text-muted-foreground mt-1">{s.body}</p>
                  <div className="mt-3">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/artist/profile">Update your pricing strategy</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Real metric cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<CalendarCheck2 className="w-4 h-4 text-primary" />}
          label="Confirmed this month"
          value={counts.confirmedThisMonth.toString()}
          hint="Includes off-platform performances you've logged."
        />
        <MetricCard
          icon={<CalendarCheck2 className="w-4 h-4 text-primary" />}
          label="Next 90 days"
          value={counts.confirmedNext90.toString()}
          hint="Confirmed and tentative combined."
        />
        <MetricCard
          icon={<MapPin className="w-4 h-4 text-primary" />}
          label="Cities performed"
          value={counts.cities.toString()}
          hint={counts.cityList.slice(0, 5).join(", ") || "—"}
        />
        <MetricCard
          icon={<Repeat className="w-4 h-4 text-primary" />}
          label="Repeat promoters"
          value={counts.repeatPromoters.toString()}
          hint="Promoters who've booked you more than once."
        />
        <MetricCard
          icon={<Coins className="w-4 h-4 text-primary" />}
          label="Average booking value"
          value={fmt(counts.avgBookingCents, currency)}
          hint={
            counts.feesCount === 0
              ? "Add fees to past performances to see this."
              : `Based on ${counts.feesCount} logged fees.`
          }
        />
      </div>

      {counts.confirmedNext90 === 0 && (
        <Card className="p-5 border-dashed">
          <p className="text-sm text-muted-foreground">
            More insights will appear as you complete more performances. Log past shows to backfill
            your career history —{" "}
            <Link to="/artist/intelligence/onboarding" className="text-primary underline">
              add a performance
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-2xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{hint}</div>}
    </Card>
  );
}
