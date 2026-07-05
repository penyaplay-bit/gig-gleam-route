import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ARTISTS,
  CITIES,
  CITY_BY_ID,
  CONFIRMED_BOOKINGS,
  EVENT_CLASSES,
  FORMATS,
  SET_LENGTHS,
  VEHICLES,
  type EventClass,
  type PerformanceFormat,
  type SetLength,
  type VehicleClass,
} from "@/lib/mock-data";
import { calculateQuote, formatMoney, roadDistance, type TransportMode } from "@/lib/quote-engine";
import { BANKING, DEFAULT_RIDER, DEFAULT_TERMS } from "@/lib/quote-terms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Penya Bookings — the quote engine, live" },
      {
        name: "description",
        content:
          "An interactive demo of the artist-booking quote engine: performance fee, real distance-based travel costs, and automatic proximity discounts.",
      },
      { property: "og:title", content: "Penya Bookings — the quote engine, live" },
      {
        property: "og:description",
        content:
          "See how a booking is priced line-by-line — Uber-style pricing for live music in Lesotho & South Africa.",
      },
    ],
  }),
  component: QuoteEngineDemo,
});

function QuoteEngineDemo() {
  const [artistId, setArtistId] = useState(ARTISTS[0].id);
  const [destinationCityId, setDestinationCityId] = useState("mokhotlong");
  const [date, setDate] = useState("2026-07-25");
  const [eventClass, setEventClass] = useState<EventClass>("festival");
  const [format, setFormat] = useState<PerformanceFormat>("band");
  const [setLength, setSetLength] = useState<SetLength>(60);
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>("quantum");
  const [eventEndsAfter10pm, setEventEndsAfter10pm] = useState(true);
  const [applyProximity, setApplyProximity] = useState(true);
  const [transportMode, setTransportMode] = useState<TransportMode>("engine");

  const quote = useMemo(
    () =>
      calculateQuote({
        artistId,
        destinationCityId,
        date,
        eventClass,
        format,
        setLength,
        vehicleClass,
        eventEndsAfter10pm,
        applyProximity,
        transportMode,
      }),
    [artistId, destinationCityId, date, eventClass, format, setLength, vehicleClass, eventEndsAfter10pm, applyProximity, transportMode],
  );

  const artistBookings = CONFIRMED_BOOKINGS.filter((b) => b.artistId === artistId);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-16">
        <Hero />

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
            <SectionLabel index={1} title="Booking request" />
            <div className="mt-6 space-y-6">
              <ArtistPicker value={artistId} onChange={setArtistId} />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Venue city">
                  <Select value={destinationCityId} onChange={setDestinationCityId}>
                    {CITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.region}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Event date">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Event class">
                <SegGroup
                  value={eventClass}
                  onChange={(v) => setEventClass(v as EventClass)}
                  options={Object.entries(EVENT_CLASSES).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                    hint: `×${v.multiplier}`,
                  }))}
                />
              </Field>

              <Field label="Performance format">
                <SegGroup
                  value={format}
                  onChange={(v) => setFormat(v as PerformanceFormat)}
                  options={Object.entries(FORMATS).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                  }))}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Set length">
                  <SegGroup
                    value={String(setLength)}
                    onChange={(v) => setSetLength(Number(v) as SetLength)}
                    options={SET_LENGTHS.map((l) => ({ value: String(l), label: `${l} min` }))}
                  />
                </Field>
                <Field label="Vehicle class">
                  <Select
                    value={vehicleClass}
                    onChange={(v) => setVehicleClass(v as VehicleClass)}
                  >
                    {Object.values(VEHICLES).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} · {v.seats} seats
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Transport & accommodation">
                <SegGroup
                  value={transportMode}
                  onChange={(v) => setTransportMode(v as TransportMode)}
                  options={[
                    { value: "engine", label: "Engine-priced" },
                    { value: "excluded", label: "Promoter arranges" },
                  ]}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {transportMode === "engine"
                    ? "Travel and accommodation are itemised in the quote and paid via platform escrow."
                    : "Current-practice mode. Quote covers performance fee only; promoter arranges transport & accommodation directly (per Ntate Stunna's live template)."}
                </p>
              </Field>

              <div className="flex flex-col gap-3 rounded-xl bg-secondary p-4">
                <Toggle
                  checked={eventEndsAfter10pm}
                  onChange={setEventEndsAfter10pm}
                  label="Event ends after 22:00"
                  hint="Triggers accommodation if >150 km"
                />
                <Toggle
                  checked={applyProximity}
                  onChange={setApplyProximity}
                  label="Apply proximity engine"
                  hint={transportMode === "excluded" ? "Only active in engine-priced mode" : "Scan artist's confirmed dates for routing discounts"}
                />
              </div>

              <ArtistTourCard bookings={artistBookings} />
            </div>
          </section>

          <div className="space-y-6">
            <QuotePanel quote={quote} transportMode={transportMode} date={date} />
            <RiderCard crewSize={quote.crewSize} />
            <TermsCard />
            <BankingCard />
          </div>
        </div>

        <FormulaFooter />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-parchment font-display text-lg">
            P
          </div>
          <div>
            <div className="font-display text-lg leading-none">Penya Bookings</div>
            <div className="text-xs text-muted-foreground">Quote engine · working demo</div>
          </div>
        </div>
        <div className="hidden text-xs text-muted-foreground md:block">
          v1.0 · July 2026 · LSL/ZAR pegged 1:1
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-ochre" />
        The wedge · algorithmic travel pricing
      </div>
      <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
        The quote is <em className="not-italic text-ochre">calculated</em>, not guessed.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
        Change any input on the left. Watch the itemised quote recalculate on the right —
        distance, vehicle, fuel, and the proximity discount that fires when the artist is
        already booked near your venue.
      </p>
    </div>
  );
}

function SectionLabel({ index, title }: { index: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-ochre text-[11px] font-semibold text-parchment">
        {index}
      </span>
      <h2 className="font-display text-xl">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      {children}
    </select>
  );
}

function SegGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl bg-secondary p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 min-w-[80px] rounded-lg px-3 py-2 text-sm font-medium transition-all",
              active
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.hint && <span className="ml-1 text-[11px] opacity-60">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between text-left"
    >
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-ochre" : "bg-border",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-card shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function ArtistPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Artist">
      <div className="grid gap-2 sm:grid-cols-3">
        {ARTISTS.map((a) => {
          const active = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-3 text-left transition-all",
                active
                  ? "border-ochre bg-card shadow-sm ring-2 ring-ochre/30"
                  : "border-border bg-card/60 hover:border-ochre/50",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg font-display text-lg",
                    active ? "bg-ochre text-parchment" : "bg-secondary text-foreground",
                  )}
                >
                  {a.photo}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-semibold">{a.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{a.tagline}</div>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                Home · {CITY_BY_ID[a.homeCityId].name}
              </div>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function ArtistTourCard({
  bookings,
}: {
  bookings: { id: string; cityId: string; date: string; label: string }[];
}) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        No confirmed bookings for this artist — proximity engine will price from home base.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-parchment-deep/40 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Confirmed dates feeding the engine
      </div>
      <ul className="space-y-1.5 text-sm">
        {bookings.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3">
            <span className="truncate">
              <span className="font-medium">{CITY_BY_ID[b.cityId].name}</span>
              <span className="text-muted-foreground"> · {b.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{b.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuotePanel({ quote }: { quote: ReturnType<typeof calculateQuote> }) {
  const route = roadDistance(quote.originCity.id, quote.destination.id);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-quote">
      <SectionLabel index={2} title="Itemised quote" />

      <div className="mt-6 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="font-display text-4xl md:text-5xl tabular-nums">
            {formatMoney(quote.total)}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            {quote.originCity.name} → {quote.destination.name}
          </div>
          <div className="tabular-nums">
            {route.km} km · {route.hours.toFixed(1)} h drive
          </div>
        </div>
      </div>

      {quote.proximityMatch && (
        <div className="mt-4 rounded-xl border border-evergreen/30 bg-evergreen/5 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-evergreen/15 text-evergreen">
              ↺
            </div>
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-evergreen">Routing discount applied</div>
              <div className="mt-1 text-muted-foreground">
                Artist performing in{" "}
                <span className="font-medium text-foreground">
                  {quote.proximityMatch.cityName}
                </span>{" "}
                on{" "}
                <span className="font-medium text-foreground">
                  {quote.proximityMatch.date}
                </span>
                . Origin re-anchored ({quote.proximityMatch.originalOriginKm} km →{" "}
                {quote.proximityMatch.newOriginKm} km).
              </div>
              <div className="mt-2 font-display text-lg text-evergreen tabular-nums">
                You save {formatMoney(quote.proximityMatch.saved)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        <LineGroup title="Performance" lines={quote.performanceLines} />
        <LineGroup
          title="Travel & logistics"
          lines={quote.travelLines}
          note={
            quote.needsAccommodation
              ? "Overnight triggered by distance / event end time."
              : undefined
          }
        />
        {quote.discountLine && <LineGroup title="Adjustments" lines={[quote.discountLine]} />}
        <LineGroup
          title="Platform"
          lines={[
            {
              key: "commission",
              label: `Booking commission (${quote.commissionPct}%)`,
              detail: "On performance fee only — travel passes through at cost.",
              amount: quote.commission,
            },
          ]}
        />
      </div>

      {quote.warnings.length > 0 && (
        <div className="mt-6 space-y-2">
          {quote.warnings.map((w, i) => (
            <div
              key={i}
              className="rounded-lg border border-ochre/40 bg-ochre-soft/60 px-3 py-2 text-xs"
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 hairline pt-4 flex items-baseline justify-between">
        <span className="text-sm font-medium">Total quote</span>
        <span className="font-display text-3xl tabular-nums">{formatMoney(quote.total)}</span>
      </div>
    </section>
  );
}

function LineGroup({
  title,
  lines,
  note,
}: {
  title: string;
  lines: { key: string; label: string; detail?: string; amount: number }[];
  note?: string;
}) {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatMoney(subtotal)}
        </span>
      </div>
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.key} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{l.label}</div>
              {l.detail && (
                <div className="text-xs text-muted-foreground">{l.detail}</div>
              )}
            </div>
            <div
              className={cn(
                "shrink-0 tabular-nums text-sm font-medium",
                l.amount < 0 && "text-evergreen",
              )}
            >
              {formatMoney(l.amount)}
            </div>
          </li>
        ))}
      </ul>
      {note && <div className="mt-2 text-[11px] italic text-muted-foreground">{note}</div>}
    </div>
  );
}

function FormulaFooter() {
  return (
    <div className="mt-14 rounded-2xl border border-border bg-card/60 p-6 md:p-8">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        The formula
      </div>
      <pre className="mt-3 whitespace-pre-wrap font-display text-lg md:text-xl leading-relaxed">
        {`TOTAL = Performance Fee
      + Travel & Logistics
      + Extras (production, crew, per diems)
      − Proximity Discount
      + Platform Commission`}
      </pre>
      <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
        Every line item is visible to the booker. Nothing is a lump sum. Travel is passed
        through at cost — the platform never commissions logistics. That's the trust wedge.
      </p>
    </div>
  );
}
