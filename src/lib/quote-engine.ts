import {
  ARTISTS,
  BORDER_FEE,
  CITY_BY_ID,
  CONFIRMED_BOOKINGS,
  EVENT_CLASSES,
  FORMATS,
  FUEL_PRICES,
  PEAK_WINDOWS,
  ROAD_OVERRIDES,
  VEHICLES,
  setLengthMultiplier,
  type Artist,
  type City,
  type EventClass,
  type PerformanceFormat,
  type SetLength,
  type VehicleClass,
} from "./mock-data";

export type TransportMode = "engine" | "excluded";

export interface QuoteInput {
  artistId: string;
  destinationCityId: string;
  date: string; // ISO date
  eventClass: EventClass;
  format: PerformanceFormat;
  setLength: SetLength;
  vehicleClass: VehicleClass;
  eventEndsAfter10pm: boolean;
  applyProximity: boolean;
  transportMode: TransportMode;
  partySizeOverride?: number;
}

export interface QuoteLine {
  key: string;
  label: string;
  detail?: string;
  amount: number; // positive add, negative deduct
}

export interface ProximityMatch {
  bookingLabel: string;
  cityName: string;
  date: string;
  originalOriginKm: number;
  newOriginKm: number;
  saved: number;
}

export interface QuoteResult {
  artist: Artist;
  destination: City;
  originCity: City;
  homeCity: City;
  distanceKm: number; // one-way used
  driveHours: number;
  vehicleDays: number;
  crewSize: number;
  needsAccommodation: boolean;
  performanceLines: QuoteLine[];
  travelLines: QuoteLine[];
  extrasLines: QuoteLine[];
  discountLine?: QuoteLine;
  proximityMatch?: ProximityMatch;
  peakMultiplierApplied?: number;
  subtotal: number;
  commissionPct: number;
  commission: number;
  total: number;
  warnings: string[];
}

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

function haversineKm(a: City, b: City): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Simulates the Distance Matrix API: uses road overrides when known, else
 * inflates great-circle distance by 1.3× to approximate road distance. */
export function roadDistance(
  originId: string,
  destId: string,
): { km: number; hours: number; requires4x4: boolean; border: boolean } {
  if (originId === destId) return { km: 0, hours: 0, requires4x4: false, border: false };
  const key1 = `${originId}|${destId}`;
  const key2 = `${destId}|${originId}`;
  const hit = ROAD_OVERRIDES[key1] ?? ROAD_OVERRIDES[key2];
  if (hit) {
    return {
      km: hit.km,
      hours: hit.hours,
      requires4x4: hit.requires4x4 ?? false,
      border: hit.border ?? false,
    };
  }
  const o = CITY_BY_ID[originId];
  const d = CITY_BY_ID[destId];
  const km = Math.round(haversineKm(o, d) * 1.3);
  const border = o.region !== d.region;
  return { km, hours: km / 85, requires4x4: false, border };
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

function fuelPriceFor(city: City): number {
  return FUEL_PRICES[city.region].pricePerLitre;
}

function activePeak(date: string) {
  return PEAK_WINDOWS.find((w) => date >= w.start && date <= w.end);
}

function computeTravelBlock(
  artist: Artist,
  origin: City,
  destination: City,
  vehicleClass: VehicleClass,
  crewSize: number,
  eventEndsAfter10pm: boolean,
): {
  lines: QuoteLine[];
  needsAccommodation: boolean;
  distanceKm: number;
  driveHours: number;
  vehicleDays: number;
  totalCost: number;
} {
  const vehicle = VEHICLES[vehicleClass];
  const route = roadDistance(origin.id, destination.id);
  const roundKm = route.km * 2;

  // Accommodation decided first — it drives the day count.
  const needsAccommodation =
    route.km > 350 || (eventEndsAfter10pm && route.km > 150);

  // Day trip: round-trip drive fits alongside the event in one day and no
  // overnight is triggered. Otherwise: driving days (8h/day) + event day.
  const vehicleDays =
    !needsAccommodation && route.hours * 2 <= 9
      ? 1
      : Math.max(2, Math.ceil((route.hours * 2) / 8) + 1);

  const litres = roundKm / vehicle.kmPerLitre;
  const fuelPrice = fuelPriceFor(origin);
  const fuelCost = Math.round(litres * fuelPrice);
  const vehicleCost = vehicle.dayRate * vehicleDays;
  const driverCost = artist.driverAllowance * vehicleDays;

  const roomsNeeded = Math.ceil(crewSize / 2);
  const accomCost = needsAccommodation ? artist.accomPerRoom * roomsNeeded : 0;
  const perDiemDays = vehicleDays;
  const perDiemCost = artist.perDiem * crewSize * perDiemDays;
  const borderCost = route.border ? BORDER_FEE : 0;

  const lines: QuoteLine[] = [
    {
      key: "vehicle",
      label: `Vehicle · ${vehicle.label}`,
      detail: `${vehicleDays} day${vehicleDays > 1 ? "s" : ""} × M${vehicle.dayRate.toLocaleString()}`,
      amount: vehicleCost,
    },
    {
      key: "fuel",
      label: "Fuel",
      detail: `${roundKm} km round-trip ÷ ${vehicle.kmPerLitre} km/ℓ × M${fuelPrice.toFixed(2)}/ℓ`,
      amount: fuelCost,
    },
    {
      key: "driver",
      label: "Driver allowance",
      detail: `${vehicleDays} × M${artist.driverAllowance}`,
      amount: driverCost,
    },
  ];

  if (borderCost) {
    lines.push({ key: "border", label: "Border fee", detail: "Cross-border adder", amount: borderCost });
  }
  if (accomCost) {
    lines.push({
      key: "accom",
      label: "Accommodation",
      detail: `${roomsNeeded} room${roomsNeeded > 1 ? "s" : ""} × M${artist.accomPerRoom}`,
      amount: accomCost,
    });
  }
  lines.push({
    key: "perdiem",
    label: "Per diems",
    detail: `${crewSize} pax × ${perDiemDays} day${perDiemDays > 1 ? "s" : ""} × M${artist.perDiem}`,
    amount: perDiemCost,
  });

  const totalCost = lines.reduce((s, l) => s + l.amount, 0);
  return {
    lines,
    needsAccommodation,
    distanceKm: route.km,
    driveHours: route.hours,
    vehicleDays,
    totalCost,
  };
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  const artist = ARTISTS.find((a) => a.id === input.artistId)!;
  const homeCity = CITY_BY_ID[artist.homeCityId];
  const destination = CITY_BY_ID[input.destinationCityId];
  const format = FORMATS[input.format];
  const eventClass = EVENT_CLASSES[input.eventClass];
  const crewSize = input.partySizeOverride ?? format.crew;
  const warnings: string[] = [];

  // Performance fee
  const feeMultiplier =
    format.baseMultiplier * eventClass.multiplier * setLengthMultiplier(input.setLength);
  const peak = activePeak(input.date);
  const peakMult = peak?.multiplier ?? 1;
  const performanceFee = Math.round(artist.basePerformanceFee * feeMultiplier * peakMult);

  const performanceLines: QuoteLine[] = [
    {
      key: "perf-base",
      label: `Performance · ${format.label}`,
      detail: `${eventClass.label} · ${input.setLength} min · base M${artist.basePerformanceFee.toLocaleString()} × ${feeMultiplier.toFixed(2)}`,
      amount: Math.round(artist.basePerformanceFee * feeMultiplier),
    },
  ];
  if (peak) {
    performanceLines.push({
      key: "peak",
      label: `Peak-date surge · ${peak.label}`,
      detail: `×${peak.multiplier}`,
      amount: performanceFee - Math.round(artist.basePerformanceFee * feeMultiplier),
    });
  }

  // Baseline travel from home city
  const baseTravel = computeTravelBlock(
    artist,
    homeCity,
    destination,
    input.vehicleClass,
    crewSize,
    input.eventEndsAfter10pm,
  );

  // Proximity scan (only relevant when engine is pricing travel)
  let usedTravel = baseTravel;
  let originCity = homeCity;
  let proximityMatch: ProximityMatch | undefined;
  let discountLine: QuoteLine | undefined;

  // Date-conflict check — runs regardless of transport mode or proximity
  // toggle. A same-day confirmed booking is a conflict, never a discount.
  const sameDay = CONFIRMED_BOOKINGS.find(
    (b) => b.artistId === artist.id && b.date === input.date,
  );
  if (sameDay) {
    warnings.push(
      `CONFLICT: artist already confirmed in ${CITY_BY_ID[sameDay.cityId].name} on ${sameDay.date} (${sameDay.label}). This date cannot be booked without manager approval.`,
    );
  }

  if (
    !sameDay &&
    input.transportMode === "engine" &&
    input.applyProximity &&
    artist.discountPolicy !== "off"
  ) {
    const candidates = CONFIRMED_BOOKINGS.filter(
      (b) => b.artistId === artist.id && b.date !== input.date,
    )
      .map((b) => {
        const distKm = roadDistance(b.cityId, destination.id).km;
        const daysAway = daysBetween(b.date, input.date);
        return { b, distKm, daysAway };
      })
      .filter(
        (c) =>
          c.distKm <= artist.proximityRadiusKm && c.daysAway <= artist.proximityWindowDays,
      )
      .sort((a, b) => a.distKm - b.distKm);

    const best = candidates[0];
    if (best) {
      const nearbyCity = CITY_BY_ID[best.b.cityId];
      const altTravel = computeTravelBlock(
        artist,
        nearbyCity,
        destination,
        input.vehicleClass,
        crewSize,
        input.eventEndsAfter10pm,
      );
      let saved = baseTravel.totalCost - altTravel.totalCost;
      if (artist.discountPolicy === "capped" && artist.discountCapPct) {
        const maxSaving = Math.round((baseTravel.totalCost * artist.discountCapPct) / 100);
        saved = Math.min(saved, maxSaving);
      }
      if (saved > 0) {
        usedTravel = altTravel;
        originCity = nearbyCity;
        proximityMatch = {
          bookingLabel: best.b.label,
          cityName: nearbyCity.name,
          date: best.b.date,
          originalOriginKm: baseTravel.distanceKm,
          newOriginKm: altTravel.distanceKm,
          saved,
        };
        discountLine = {
          key: "proximity",
          label: "Routing discount",
          detail: `Artist already confirmed near ${nearbyCity.name} on ${best.b.date} — origin re-anchored`,
          amount: -saved,
        };
      }
    }
  }

  // Travel/logistics rendering respects the transport mode.
  const isExcluded = input.transportMode === "excluded";
  const travelLinesOut: QuoteLine[] = isExcluded
    ? [
        {
          key: "transport-excluded",
          label: "Transport",
          detail: "Excluded — to be arranged and covered by the promoter",
          amount: 0,
        },
        {
          key: "accom-excluded",
          label: "Accommodation",
          detail: `Excluded — promoter arranges for artist + team of ${crewSize}`,
          amount: 0,
        },
      ]
    : (proximityMatch ? usedTravel : baseTravel).lines;
  const travelCost = isExcluded ? 0 : (proximityMatch ? usedTravel : baseTravel).totalCost;

  // Warnings
  const requires4x4 = roadDistance(originCity.id, destination.id).requires4x4;
  if (!isExcluded && requires4x4 && input.vehicleClass !== "4x4") {
    warnings.push("Highland route detected — 4×4 recommended for reliability.");
  }
  if (!isExcluded && VEHICLES[input.vehicleClass].seats < crewSize) {
    warnings.push(
      `Selected vehicle seats ${VEHICLES[input.vehicleClass].seats}; crew is ${crewSize}. Consider Quantum.`,
    );
  }

  const commissionPct = 10;
  const subtotal = performanceFee + travelCost;
  const commission = Math.round((performanceFee * commissionPct) / 100);
  const total = subtotal + commission;

  return {
    artist,
    destination,
    originCity,
    homeCity,
    distanceKm: (proximityMatch ? usedTravel : baseTravel).distanceKm,
    driveHours: (proximityMatch ? usedTravel : baseTravel).driveHours,
    vehicleDays: (proximityMatch ? usedTravel : baseTravel).vehicleDays,
    crewSize,
    needsAccommodation: isExcluded ? false : (proximityMatch ? usedTravel : baseTravel).needsAccommodation,
    performanceLines,
    travelLines: travelLinesOut,
    extrasLines: [],
    discountLine: isExcluded ? undefined : discountLine,
    proximityMatch: isExcluded ? undefined : proximityMatch,
    peakMultiplierApplied: peak?.multiplier,
    subtotal,
    commissionPct,
    commission,
    total,
    warnings,
  };
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}M ${Math.abs(Math.round(n)).toLocaleString()}`;
}
