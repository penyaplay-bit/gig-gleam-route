// Artist Pricing Engine — pure, no I/O.
// Money is stored/returned as integer cents (e.g. R50,000 = 5_000_000).

export type Currency = "ZAR" | "USD" | "LSL";

export interface TransportRules {
  car_hire_day_rate: number;         // cents/day
  fuel_rate_per_km: number;          // cents/km
  default_car_hire_days: number;
  default_fuel_estimate: number;     // cents (used when distance unknown)
  local_max_km: number;              // <= this: fuel only
  car_hire_max_km: number;           // <= this: fuel + car hire; > this: overnight
  overnight_min_km: number;
  flight_seat_estimate: number;      // cents/seat (rough)
}

export interface AccommodationRules {
  room_rate: number;                 // cents/room/night
  pax_per_room: number;
  default_nights: number;
  default_total?: number;            // if set, uses this instead of formula
}

export interface PerDiemRules {
  per_person_per_day: number;        // cents
}

export interface PaymentTerms {
  booking_logistics_pct: number;     // 100 = full logistics on booking
  booking_fee_pct: number;           // e.g. 50
  final_fee_pct: number;             // e.g. 50
  final_days_before_event: number;   // e.g. 7
}

export interface RiderItem {
  label: string;
  scale: "fixed" | "per_team" | "per_room";
  qty: number;
  note?: string;
}
export interface RiderSection { title: string; items: RiderItem[] }
export interface RiderConfig { sections: RiderSection[] }

export interface ArtistProfileConfig {
  id: string;
  name: string;
  currency: Currency;
  base_fee: number;
  default_team_size: number;
  home_city: string | null;
  home_address: string | null;
  home_country_code: string | null;
  home_country: string;
  transport_rules: TransportRules;
  accommodation_rules: AccommodationRules;
  per_diem_rules: PerDiemRules;
  payment_terms: PaymentTerms;
  cancellation_terms: Record<string, string>;
  rider: RiderConfig;
  banking: Record<string, string>;
  min_margin_pct: number;
  profile_version: number;
}

export interface QuoteInputs {
  event_name: string;
  event_date: string;                // ISO YYYY-MM-DD
  event_type: string;
  venue?: string;
  country: string;
  city?: string;
  attendance?: number;
  team_size?: number;
  distance_km?: number;              // one-way
  cross_border?: boolean;
  overnight_required?: boolean;
  flights_required?: boolean;
  extra_nights?: number;
  security_required?: boolean;
  equipment_cost?: number;           // cents
  security_cost?: number;            // cents
  tax_pct?: number;                  // e.g. 15 for 15% VAT
  discount?: number;                 // cents (positive = deducted)
  fee_override?: number;             // cents; overrides base_fee if set
  notes?: string;
}

export type LineKind =
  | "fee" | "transport" | "accommodation" | "per_diem"
  | "equipment" | "security" | "flights" | "visa"
  | "tax" | "discount";

export interface QuoteLine {
  key: string;
  kind: LineKind;
  label: string;
  detail?: string;
  amount: number; // cents; discount is negative
}

export type PaymentKind = "booking" | "final";
export interface PaymentInstallment {
  kind: PaymentKind;
  label: string;
  amount: number;   // cents
  due_date: string; // ISO YYYY-MM-DD
  condition: string;
}

export interface DistanceInfo {
  km: number;
  band: "local" | "regional" | "long" | "international";
  needs_car_hire: boolean;
  needs_overnight: boolean;
  needs_flights: boolean;
}

export interface QuoteResult {
  profile_id: string;
  profile_version: number;
  currency: Currency;
  inputs: QuoteInputs;
  distance: DistanceInfo | null;
  team_size: number;
  lines: QuoteLine[];
  fee_total: number;
  logistics_total: number;   // everything except fee and taxes/discounts
  tax_total: number;
  discount_total: number;
  subtotal: number;          // fee + logistics
  total: number;             // fee + logistics + tax - discount
  payment_schedule: PaymentInstallment[];
  warnings: string[];
  min_acceptable_total: number;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function daysBefore(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function classifyDistance(
  rules: TransportRules,
  km: number | undefined,
  crossBorder: boolean | undefined,
): DistanceInfo | null {
  if (crossBorder) {
    return {
      km: km ?? 0,
      band: "international",
      needs_car_hire: false,
      needs_overnight: true,
      needs_flights: true,
    };
  }
  if (km == null) return null;
  if (km <= rules.local_max_km) {
    return { km, band: "local", needs_car_hire: false, needs_overnight: false, needs_flights: false };
  }
  if (km <= rules.car_hire_max_km) {
    return { km, band: "regional", needs_car_hire: true, needs_overnight: false, needs_flights: false };
  }
  return { km, band: "long", needs_car_hire: true, needs_overnight: true, needs_flights: false };
}

// ------------------------------------------------------------------
// Line computations
// ------------------------------------------------------------------

export function computeFeeLine(
  profile: ArtistProfileConfig,
  inputs: QuoteInputs,
): QuoteLine {
  const amount = inputs.fee_override ?? profile.base_fee;
  return {
    key: "fee",
    kind: "fee",
    label: `Performance Fee — ${profile.name}`,
    detail: inputs.fee_override != null ? "Manual override" : undefined,
    amount,
  };
}

export function computeTransportLines(
  profile: ArtistProfileConfig,
  inputs: QuoteInputs,
  distance: DistanceInfo | null,
  teamSize: number,
): QuoteLine[] {
  const rules = profile.transport_rules;
  const lines: QuoteLine[] = [];

  // Flights first if applicable
  if (distance?.needs_flights || inputs.flights_required) {
    const seats = teamSize;
    const amount = seats * rules.flight_seat_estimate;
    lines.push({
      key: "flights",
      kind: "flights",
      label: "Flights",
      detail: `${seats} seats × R${(rules.flight_seat_estimate / 100).toLocaleString()} (est.)`,
      amount,
    });
    // No car hire when flying
    return lines;
  }

  // No distance info yet — fall back to profile defaults
  if (!distance) {
    const days = rules.default_car_hire_days;
    lines.push({
      key: "car_hire",
      kind: "transport",
      label: "Transport — Car Hire",
      detail: `${days} days @ R${(rules.car_hire_day_rate / 100).toLocaleString()}`,
      amount: days * rules.car_hire_day_rate,
    });
    lines.push({
      key: "fuel",
      kind: "transport",
      label: "Transport — Fuel (est.)",
      detail: "Distance not provided",
      amount: rules.default_fuel_estimate,
    });
    return lines;
  }

  if (distance.needs_car_hire) {
    // Car hire days: overnight ⇒ 2 days minimum; else 1 day.
    const days = distance.needs_overnight
      ? Math.max(2, rules.default_car_hire_days)
      : Math.max(1, Math.min(2, rules.default_car_hire_days));
    lines.push({
      key: "car_hire",
      kind: "transport",
      label: "Transport — Car Hire",
      detail: `${days} days @ R${(rules.car_hire_day_rate / 100).toLocaleString()}`,
      amount: days * rules.car_hire_day_rate,
    });
  }
  // Fuel from distance (round trip)
  const roundKm = distance.km * 2;
  const fuel = Math.round(roundKm * rules.fuel_rate_per_km);
  lines.push({
    key: "fuel",
    kind: "transport",
    label: "Transport — Fuel",
    detail: `${roundKm} km round-trip × R${(rules.fuel_rate_per_km / 100).toFixed(2)}/km`,
    amount: fuel,
  });

  return lines;
}

export function computeAccommodationLine(
  profile: ArtistProfileConfig,
  inputs: QuoteInputs,
  distance: DistanceInfo | null,
  teamSize: number,
): QuoteLine | null {
  const overnight = inputs.overnight_required
    ?? distance?.needs_overnight
    ?? false;
  if (!overnight) return null;
  const rules = profile.accommodation_rules;
  const nights = rules.default_nights + (inputs.extra_nights ?? 0);
  const rooms = Math.ceil(teamSize / rules.pax_per_room);
  // If a fixed default_total is set and nights=default and teamSize matches, use it
  const useDefault = rules.default_total != null
    && nights === rules.default_nights
    && teamSize === profile.default_team_size;
  const amount = useDefault
    ? rules.default_total!
    : rooms * nights * rules.room_rate;
  return {
    key: "accommodation",
    kind: "accommodation",
    label: "Accommodation",
    detail: `${rooms} room${rooms > 1 ? "s" : ""} × ${nights} night${nights > 1 ? "s" : ""} · team of ${teamSize}`,
    amount,
  };
}

export function computePerDiemLine(
  profile: ArtistProfileConfig,
  _inputs: QuoteInputs,
  teamSize: number,
  days: number,
): QuoteLine | null {
  const rate = profile.per_diem_rules.per_person_per_day;
  if (!rate || rate <= 0) return null;
  const amount = rate * teamSize * days;
  return {
    key: "per_diem",
    kind: "per_diem",
    label: "Per Diem",
    detail: `${teamSize} pax × ${days} day${days > 1 ? "s" : ""} × R${(rate / 100).toLocaleString()}`,
    amount,
  };
}

// ------------------------------------------------------------------
// Rider
// ------------------------------------------------------------------

export interface ExpandedRiderItem {
  label: string;
  qty: number;
  note?: string;
}
export interface ExpandedRiderSection { title: string; items: ExpandedRiderItem[] }

export function expandRider(
  profile: ArtistProfileConfig,
  teamSize: number,
): ExpandedRiderSection[] {
  const rooms = Math.ceil(teamSize / profile.accommodation_rules.pax_per_room);
  return (profile.rider.sections ?? []).map((s) => ({
    title: s.title,
    items: s.items.map((it) => {
      let qty = it.qty;
      if (it.scale === "per_team") qty = it.qty * teamSize;
      else if (it.scale === "per_room") qty = it.qty * rooms;
      return { label: it.label, qty, note: it.note };
    }),
  }));
}

// ------------------------------------------------------------------
// Main compute
// ------------------------------------------------------------------

export function computeQuote(
  profile: ArtistProfileConfig,
  inputs: QuoteInputs,
): QuoteResult {
  const warnings: string[] = [];
  const teamSize = inputs.team_size ?? profile.default_team_size;
  const distance = classifyDistance(
    profile.transport_rules,
    inputs.distance_km,
    inputs.cross_border,
  );

  const feeLine = computeFeeLine(profile, inputs);
  const transportLines = computeTransportLines(profile, inputs, distance, teamSize);
  const accomLine = computeAccommodationLine(profile, inputs, distance, teamSize);

  // Per diem days = 1 base + extra nights (rough)
  const perDiemDays = 1 + (inputs.extra_nights ?? 0);
  const perDiemLine = computePerDiemLine(profile, inputs, teamSize, perDiemDays);

  const lines: QuoteLine[] = [feeLine, ...transportLines];
  if (accomLine) lines.push(accomLine);
  if (perDiemLine) lines.push(perDiemLine);
  if (inputs.equipment_cost && inputs.equipment_cost > 0) {
    lines.push({
      key: "equipment",
      kind: "equipment",
      label: "Equipment",
      amount: inputs.equipment_cost,
    });
  }
  if ((inputs.security_required || (inputs.security_cost ?? 0) > 0) && (inputs.security_cost ?? 0) > 0) {
    lines.push({
      key: "security",
      kind: "security",
      label: "Security",
      amount: inputs.security_cost!,
    });
  } else if (inputs.security_required && !inputs.security_cost) {
    warnings.push("Security marked as required but no cost provided.");
  }

  // Subtotal before tax/discount
  const fee_total = lines.filter((l) => l.kind === "fee").reduce((s, l) => s + l.amount, 0);
  const logistics_total = lines
    .filter((l) => l.kind !== "fee" && l.kind !== "tax" && l.kind !== "discount")
    .reduce((s, l) => s + l.amount, 0);
  const subtotal = fee_total + logistics_total;

  // Tax
  let tax_total = 0;
  if (inputs.tax_pct && inputs.tax_pct > 0) {
    tax_total = Math.round((subtotal * inputs.tax_pct) / 100);
    lines.push({
      key: "tax",
      kind: "tax",
      label: `Tax (${inputs.tax_pct}%)`,
      amount: tax_total,
    });
  }

  // Discount
  let discount_total = 0;
  if (inputs.discount && inputs.discount > 0) {
    discount_total = inputs.discount;
    lines.push({
      key: "discount",
      kind: "discount",
      label: "Discount",
      amount: -discount_total,
    });
  }

  const total = subtotal + tax_total - discount_total;

  // Payment schedule
  const terms = profile.payment_terms;
  const bookingLogistics = Math.round((logistics_total * terms.booking_logistics_pct) / 100);
  const bookingFee = Math.round((fee_total * terms.booking_fee_pct) / 100);
  const bookingAmount = bookingLogistics + bookingFee;
  const finalAmount = total - bookingAmount;
  const finalDue = daysBefore(inputs.event_date, terms.final_days_before_event);
  const today = new Date().toISOString().slice(0, 10);

  const payment_schedule: PaymentInstallment[] = [
    {
      kind: "booking",
      label: `Booking Payment · logistics (${terms.booking_logistics_pct}%) + fee (${terms.booking_fee_pct}%)`,
      amount: bookingAmount,
      due_date: today,
      condition: "Upon booking confirmation",
    },
    {
      kind: "final",
      label: `Final Payment · fee (${terms.final_fee_pct}%)`,
      amount: finalAmount,
      due_date: finalDue,
      condition: `Latest ${terms.final_days_before_event} days before event`,
    },
  ];

  // Profitability floor (rough): costs + min_margin_pct of fee.
  // "Costs" here = logistics only; performance fee is the margin lever.
  const costs = logistics_total;
  const min_acceptable_total =
    costs + Math.round((fee_total * (100 - profile.min_margin_pct)) / 100);

  if (distance?.band === "long" && !accomLine) {
    warnings.push("Distance > 400 km — overnight accommodation recommended.");
  }

  return {
    profile_id: profile.id,
    profile_version: profile.profile_version,
    currency: profile.currency,
    inputs,
    distance,
    team_size: teamSize,
    lines,
    fee_total,
    logistics_total,
    tax_total,
    discount_total,
    subtotal,
    total,
    payment_schedule,
    warnings,
    min_acceptable_total,
  };
}

// ------------------------------------------------------------------
// Formatting helpers
// ------------------------------------------------------------------

export function formatCents(cents: number, currency: Currency = "ZAR"): string {
  const sign = cents < 0 ? "-" : "";
  const rands = Math.abs(cents) / 100;
  const symbol = currency === "ZAR" ? "R" : currency === "USD" ? "$" : "M";
  return `${sign}${symbol} ${rands.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
