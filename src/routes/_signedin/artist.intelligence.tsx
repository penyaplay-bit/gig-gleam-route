// Artist Intelligence dashboard — venue intelligence, promoter intelligence,
// fanbase heat map, seasonality, routes, and career timeline.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, MapPin, Users2, Building2, TrendingUp, CalendarDays, Route as RouteIcon, Trophy,
} from "lucide-react";
import { getIntelDashboard } from "@/lib/intel/performances.functions";

export const Route = createFileRoute("/_signedin/artist/intelligence")({
  head: () => ({
    meta: [
      { title: "Artist Intelligence — Penya Play" },
      { name: "description", content: "Your booking DNA: fanbase heat map, venue intelligence, promoter relationships, touring corridors and seasonality." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligencePage,
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function IntelligencePage() {
  const load = useServerFn(getIntelDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["artist-intel"],
    queryFn: () => load(),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading your intelligence…</div>;

  const empty = !data || data.stats.total_shows === 0;

  if (empty) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 text-center border-primary/30 bg-primary/5">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-display">Build your Booking DNA</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-md mx-auto">
            Tell Penya Play about the shows you've performed — even before you joined. The engine builds a fanbase heat map, promoter relationships and touring corridors so we can find your highest-value opportunities.
          </p>
          <Button asChild size="lg">
            <Link to="/artist/intelligence/onboarding">Start career mapping</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const seasonMax = Math.max(1, ...Object.values(data.seasonality));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Artist Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">Your booking DNA — updated every time you log a performance.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/artist/intelligence/onboarding">Add performances</Link>
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total shows" value={data.stats.total_shows} />
        <StatCard label="Years active" value={data.stats.years_active} />
        <StatCard label="Countries" value={data.stats.countries} />
        <StatCard label="Largest crowd" value={data.stats.largest_crowd?.toLocaleString() ?? "—"} />
        <StatCard label="Last show" value={data.stats.last_show ?? "—"} />
      </div>

      {/* Fanbase heat map */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-primary" />
          <h2 className="font-medium">Fanbase heat map</h2>
        </div>
        {data.topCities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add performances to see your top cities.</p>
        ) : (
          <div className="space-y-2">
            {data.topCities.slice(0, 8).map((c, i) => {
              const pct = (c.count / data.topCities[0].count) * 100;
              return (
                <div key={`${c.city}-${i}`} className="flex items-center gap-3">
                  <div className="w-6 text-xs text-muted-foreground">{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.city}{c.country ? `, ${c.country}` : ""}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.count} shows{c.last_show_at ? ` · last ${c.last_show_at}` : ""}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded mt-1 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Venues */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="font-medium">Venue intelligence</h2>
          </div>
          {data.topVenues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No venues yet.</p>
          ) : (
            <div className="space-y-3">
              {data.topVenues.slice(0, 6).map((v) => (
                <div key={v.name} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Booked {v.count}× · last {v.last_booked_at}
                      {v.avg_crowd ? ` · avg ${v.avg_crowd.toLocaleString()}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline">{v.strength}%</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Promoters */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users2 className="w-4 h-4 text-primary" />
            <h2 className="font-medium">Promoter intelligence</h2>
          </div>
          {data.topPromoters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Log a promoter with a performance to start tracking relationships.</p>
          ) : (
            <div className="space-y-3">
              {data.topPromoters.slice(0, 6).map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Worked together {p.count}× · last {p.last_booked_at ?? "—"}
                    </div>
                  </div>
                  <Badge variant="outline">{p.strength}%</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Seasonality + Routes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h2 className="font-medium">Calendar calibration</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Historical shows don't block future dates — they teach the engine your touring seasons.
          </p>
          <div className="grid grid-cols-12 gap-1 items-end h-24">
            {MONTHS.map((m, i) => {
              const key = String(i + 1).padStart(2, "0");
              const v = data.seasonality[key] ?? 0;
              const h = (v / seasonMax) * 100;
              return (
                <div key={m} className="flex flex-col items-center gap-1">
                  <div className="w-full bg-primary/70 rounded-sm" style={{ height: `${Math.max(h, 4)}%` }} title={`${v} shows`} />
                  <span className="text-[10px] text-muted-foreground">{m[0]}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <RouteIcon className="w-4 h-4 text-primary" />
            <h2 className="font-medium">Touring corridors</h2>
          </div>
          {data.routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Book two cities within 7 days and we'll detect your touring corridors.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.routes.map((r) => (
                <li key={r.route} className="flex items-center justify-between">
                  <span>{r.route}</span>
                  <Badge variant="secondary">{r.count}×</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Event types */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-medium">Best-converting event types</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.topEventTypes.map((t) => (
            <Badge key={t.type} variant="outline" className="capitalize">
              {t.type} · {t.count}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Timeline */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-primary" />
          <h2 className="font-medium">Career timeline</h2>
        </div>
        <ul className="space-y-3">
          {data.timeline.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-4 text-sm border-b border-border/40 pb-3 last:border-0">
              <div>
                <div className="font-medium">{p.event_name} {p.headliner && <Badge className="ml-1" variant="secondary">Headliner</Badge>}</div>
                <div className="text-xs text-muted-foreground">
                  {p.venue_name ?? "—"}{p.city ? ` · ${p.city}` : ""}{p.country ? `, ${p.country}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted-foreground">{p.event_date}</div>
                <div className="text-xs capitalize">{p.event_type}{p.crowd_est ? ` · ${p.crowd_est.toLocaleString()}` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-display mt-1">{value}</div>
    </Card>
  );
}
