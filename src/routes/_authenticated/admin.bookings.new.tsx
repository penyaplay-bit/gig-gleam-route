import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import { listArtistProfiles, previewQuote, aiSuggestPrice } from "@/lib/pricing/quote.functions";
import { computeDrivingDistance } from "@/lib/pricing/distance.functions";
import { formatCents, expandRider, type ArtistProfileConfig, type QuoteInputs, type QuoteResult } from "@/lib/pricing/artist-engine";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, FileText, Calendar, MapPin, Users, Truck, Wallet, Loader2, AlertTriangle, ChevronRight, Navigation } from "lucide-react";
import { downloadArtistQuotePdf } from "@/lib/pricing/quote-pdf";

export const Route = createFileRoute("/_authenticated/admin/bookings/new")({
  component: NewBooking,
});

const EVENT_TYPES = ["Festival", "Club", "Corporate", "Wedding", "Government", "Private", "Concert"];

function NewBooking() {
  const navigate = useNavigate();
  const fetchProfiles = useServerFn(listArtistProfiles);
  const runPreview = useServerFn(previewQuote);
  const runAi = useServerFn(aiSuggestPrice);

  const { data: profilesData } = useQuery({
    queryKey: ["artist-profiles"],
    queryFn: () => fetchProfiles(),
  });
  const profiles = (profilesData?.profiles ?? []) as ArtistProfileConfig[];

  const [profileId, setProfileId] = useState<string>("");
  useEffect(() => {
    if (!profileId && profiles.length) setProfileId(profiles[0].id);
  }, [profiles, profileId]);
  const profile = profiles.find((p) => p.id === profileId);

  const [form, setForm] = useState<QuoteInputs>({
    event_name: "",
    event_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    event_type: "Festival",
    venue: "",
    country: "South Africa",
    city: "",
    attendance: 500,
    team_size: undefined,
    distance_km: undefined,
    cross_border: false,
    overnight_required: false,
    flights_required: false,
    extra_nights: 0,
    security_required: false,
    equipment_cost: 0,
    security_cost: 0,
    tax_pct: 0,
    discount: 0,
    fee_override: undefined,
    notes: "",
  });

  useEffect(() => {
    if (profile && form.team_size == null) {
      setForm((f) => ({ ...f, team_size: profile.default_team_size }));
    }
  }, [profile, form.team_size]);

  // Debounced preview
  const [debouncedForm, setDebouncedForm] = useState(form);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedForm(form), 300);
    return () => clearTimeout(t);
  }, [form]);

  const previewQ = useQuery<QuoteResult | null>({
    queryKey: ["quote-preview", profileId, debouncedForm],
    queryFn: async () => {
      if (!profileId || !debouncedForm.event_name) return null;
      return runPreview({ data: { profile_id: profileId, inputs: debouncedForm } });
    },
    enabled: !!profileId,
  });

  const aiMut = useMutation({
    mutationFn: () => runAi({ data: { profile_id: profileId, inputs: form } }),
  });

  const quote = previewQ.data;

  function update<K extends keyof QuoteInputs>(key: K, value: QuoteInputs[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
            <Link to="/admin/bookings" className="hover:text-foreground">Bookings</Link>
            <ChevronRight className="w-3 h-3" />
            <span>New</span>
          </div>
          <h1 className="text-3xl font-display mt-1">Booking Command Centre</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every quote, payment schedule and rider is auto-computed from the artist profile.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-6">
        {/* ===== INPUTS ===== */}
        <div className="space-y-6">
          <Section title="Artist" icon={<Sparkles className="w-4 h-4" />}>
            <div>
              <Label>Artist profile</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger><SelectValue placeholder="Select artist" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {profile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Base fee <span className="text-foreground font-mono">{formatCents(profile.base_fee, profile.currency)}</span>
                  {" · "}Team of {profile.default_team_size}
                </p>
              )}
            </div>
          </Section>

          <Section title="Event" icon={<Calendar className="w-4 h-4" />}>
            <Field label="Event name">
              <Input value={form.event_name} onChange={(e) => update("event_name", e.target.value)} placeholder="Matjhabeng Fashion Week 2026" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Event date">
                <Input type="date" value={form.event_date} onChange={(e) => update("event_date", e.target.value)} />
              </Field>
              <Field label="Event type">
                <Select value={form.event_type} onValueChange={(v) => update("event_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expected attendance">
                <Input type="number" value={form.attendance ?? ""} onChange={(e) => update("attendance", Number(e.target.value) || undefined)} />
              </Field>
              <Field label="Venue">
                <Input value={form.venue ?? ""} onChange={(e) => update("venue", e.target.value)} placeholder="Wild and Out Pub" />
              </Field>
            </div>
          </Section>

          <Section title="Location" icon={<MapPin className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input value={form.city ?? ""} onChange={(e) => update("city", e.target.value)} placeholder="Welkom" />
              </Field>
              <Field label="Country">
                <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="One-way distance (km)">
                <Input type="number" value={form.distance_km ?? ""} onChange={(e) => update("distance_km", e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 250" />
              </Field>
              <Field label="Cross-border">
                <Toggle value={!!form.cross_border} onChange={(v) => update("cross_border", v)} labelOn="Yes" labelOff="No" />
              </Field>
            </div>
          </Section>

          <Section title="Logistics" icon={<Truck className="w-4 h-4" />}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Team size">
                <Input type="number" value={form.team_size ?? ""} onChange={(e) => update("team_size", Number(e.target.value) || undefined)} />
              </Field>
              <Field label="Overnight">
                <Toggle value={!!form.overnight_required} onChange={(v) => update("overnight_required", v)} labelOn="Yes" labelOff="Auto" />
              </Field>
              <Field label="Flights">
                <Toggle value={!!form.flights_required} onChange={(v) => update("flights_required", v)} labelOn="Yes" labelOff="Auto" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Extra nights">
                <Input type="number" value={form.extra_nights ?? 0} onChange={(e) => update("extra_nights", Number(e.target.value) || 0)} />
              </Field>
              <Field label="Security required">
                <Toggle value={!!form.security_required} onChange={(v) => update("security_required", v)} labelOn="Yes" labelOff="No" />
              </Field>
              <Field label="Security cost (R)">
                <Input type="number" value={centsToRand(form.security_cost)} onChange={(e) => update("security_cost", randToCents(e.target.value))} disabled={!form.security_required} />
              </Field>
            </div>
          </Section>

          <Section title="Commercials" icon={<Wallet className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fee override (R)">
                <Input type="number" value={form.fee_override != null ? centsToRand(form.fee_override) : ""} onChange={(e) => update("fee_override", e.target.value ? randToCents(e.target.value) : undefined)} placeholder="Use profile base" />
              </Field>
              <Field label="Equipment cost (R)">
                <Input type="number" value={centsToRand(form.equipment_cost)} onChange={(e) => update("equipment_cost", randToCents(e.target.value))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tax %">
                <Input type="number" value={form.tax_pct ?? 0} onChange={(e) => update("tax_pct", Number(e.target.value) || 0)} />
              </Field>
              <Field label="Discount (R)">
                <Input type="number" value={centsToRand(form.discount)} onChange={(e) => update("discount", randToCents(e.target.value))} />
              </Field>
            </div>
            <Field label="Internal notes">
              <Textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={2} />
            </Field>
          </Section>
        </div>

        {/* ===== LIVE PREVIEW ===== */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-1">
          <div className="rounded-lg border border-primary/20 bg-card/60 backdrop-blur">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Live Quotation</div>
                <div className="font-display text-lg">{profile?.name ?? "—"}</div>
              </div>
              {previewQ.isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {!quote && (
              <div className="p-6 text-sm text-muted-foreground">
                Fill in the event name to generate a live quote.
              </div>
            )}

            {quote && (
              <div className="p-4 space-y-4">
                {/* Total banner */}
                <div className="rounded-md bg-primary/10 border border-primary/30 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-primary">Total Payable</div>
                  <div className="font-display text-3xl mt-1">{formatCents(quote.total, quote.currency)}</div>
                  {quote.distance && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {quote.distance.km} km · {quote.distance.band}
                      {quote.distance.needs_overnight && " · overnight"}
                      {quote.distance.needs_flights && " · flights"}
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {quote.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                    {quote.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lines */}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Financial Breakdown</div>
                  <div className="space-y-2">
                    {quote.lines.map((l) => (
                      <div key={l.key} className="flex items-start justify-between gap-4 text-sm border-b border-border/30 pb-1.5">
                        <div>
                          <div className="text-foreground">{l.label}</div>
                          {l.detail && <div className="text-xs text-muted-foreground">{l.detail}</div>}
                        </div>
                        <div className={`font-mono tabular-nums shrink-0 ${l.amount < 0 ? "text-emerald-400" : ""}`}>
                          {formatCents(l.amount, quote.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-3 pt-2 border-t border-primary/30 text-base font-display">
                    <span>Total</span>
                    <span className="font-mono">{formatCents(quote.total, quote.currency)}</span>
                  </div>
                </div>

                {/* Payment schedule */}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Payment Schedule</div>
                  <div className="space-y-2">
                    {quote.payment_schedule.map((p) => (
                      <div key={p.kind} className="rounded-md border border-border/60 p-3 text-sm">
                        <div className="flex justify-between items-baseline gap-3">
                          <div className="font-medium">{p.label}</div>
                          <div className="font-mono">{formatCents(p.amount, quote.currency)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {p.condition} · due {p.due_date}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rider */}
                {profile && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Hospitality Rider (team of {quote.team_size})</div>
                    <div className="space-y-2">
                      {expandRider(profile, quote.team_size).map((s) => (
                        <div key={s.title} className="rounded-md border border-border/40 p-2">
                          <div className="text-xs font-medium mb-1">{s.title}</div>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {s.items.map((it, i) => (
                              <li key={i} className="flex justify-between gap-2">
                                <span>{it.label}{it.note ? ` — ${it.note}` : ""}</span>
                                <span className="font-mono tabular-nums">×{it.qty}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Suggestion */}
                <div className="rounded-md border border-primary/20 bg-primary/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Pricing Suggestion
                    </div>
                    <Button size="sm" variant="outline" onClick={() => aiMut.mutate()} disabled={aiMut.isPending}>
                      {aiMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Analyse"}
                    </Button>
                  </div>
                  {aiMut.data && (
                    <div className="mt-2 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Suggested fee</span>
                        <span className="font-mono">{formatCents(aiMut.data.suggested_fee_cents, quote.currency)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{aiMut.data.reasoning}</div>
                      <div className="text-xs flex gap-3 mt-1">
                        <span>Risk {aiMut.data.risk_score}/100</span>
                        <span>Confidence: {aiMut.data.confidence}</span>
                      </div>
                      <div className="pt-1">
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => update("fee_override", aiMut.data!.suggested_fee_cents)}
                        >
                          Apply to quote →
                        </button>
                      </div>
                    </div>
                  )}
                  {aiMut.error && <div className="text-xs text-red-400 mt-1">{(aiMut.error as Error).message}</div>}
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!quote || !profile}
                    onClick={() => profile && downloadArtistQuotePdf(profile, quote)}
                  >
                    <FileText className="w-4 h-4 mr-2" /> Generate Quotation PDF
                  </Button>
                  <Button variant="outline" onClick={() => navigate({ to: "/admin/bookings" })}>
                    Back to bookings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Local UI helpers ============
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}<span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, labelOn, labelOff }: { value: boolean; onChange: (v: boolean) => void; labelOn: string; labelOff: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`h-9 w-full rounded-md border text-sm font-medium transition ${
        value
          ? "bg-primary/20 border-primary/40 text-primary"
          : "bg-transparent border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {value ? labelOn : labelOff}
    </button>
  );
}

function centsToRand(cents: number | undefined): string {
  if (!cents) return "";
  return String(Math.round(cents / 100));
}
function randToCents(v: string): number {
  const n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
