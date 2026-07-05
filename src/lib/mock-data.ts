// Mock data for the quote engine demo. All figures illustrative.

export type Currency = "LSL" | "ZAR"; // pegged 1:1 for the demo

export type VehicleClass = "sedan" | "quantum" | "4x4";

export interface VehicleConfig {
  id: VehicleClass;
  label: string;
  dayRate: number; // in Maloti/Rand
  kmPerLitre: number;
  seats: number;
}

export const VEHICLES: Record<VehicleClass, VehicleConfig> = {
  sedan: { id: "sedan", label: "Sedan", dayRate: 900, kmPerLitre: 14, seats: 4 },
  quantum: { id: "quantum", label: "Toyota Quantum", dayRate: 1800, kmPerLitre: 9, seats: 10 },
  "4x4": { id: "4x4", label: "4×4 (highland routes)", dayRate: 2400, kmPerLitre: 8, seats: 5 },
};

export type EventClass = "private" | "corporate" | "festival" | "televised";

export const EVENT_CLASSES: Record<EventClass, { label: string; multiplier: number }> = {
  private: { label: "Private", multiplier: 1.0 },
  corporate: { label: "Corporate", multiplier: 1.3 },
  festival: { label: "Festival", multiplier: 1.5 },
  televised: { label: "Televised", multiplier: 2.0 },
};

export type PerformanceFormat = "solo" | "dj" | "band" | "appearance";

export const FORMATS: Record<PerformanceFormat, { label: string; baseMultiplier: number; crew: number }> = {
  appearance: { label: "Appearance only", baseMultiplier: 0.4, crew: 1 },
  dj: { label: "DJ set", baseMultiplier: 0.6, crew: 1 },
  solo: { label: "Solo + backing vocalist", baseMultiplier: 0.75, crew: 3 },
  band: { label: "Full band", baseMultiplier: 1.0, crew: 6 },
};

export interface City {
  id: string;
  name: string;
  region: "LS" | "SA";
  lat: number;
  lon: number;
}

// A pragmatic subset — enough to demo cross-border + highland routing.
export const CITIES: City[] = [
  { id: "maseru", name: "Maseru", region: "LS", lat: -29.31, lon: 27.48 },
  { id: "leribe", name: "Leribe", region: "LS", lat: -28.87, lon: 28.05 },
  { id: "mafeteng", name: "Mafeteng", region: "LS", lat: -29.82, lon: 27.24 },
  { id: "mohales-hoek", name: "Mohale's Hoek", region: "LS", lat: -30.15, lon: 27.47 },
  { id: "quthing", name: "Quthing", region: "LS", lat: -30.40, lon: 27.70 },
  { id: "thaba-tseka", name: "Thaba-Tseka", region: "LS", lat: -29.53, lon: 28.61 },
  { id: "mokhotlong", name: "Mokhotlong", region: "LS", lat: -29.29, lon: 29.07 },
  { id: "qacha", name: "Qacha's Nek", region: "LS", lat: -30.11, lon: 28.69 },
  { id: "bloem", name: "Bloemfontein", region: "SA", lat: -29.09, lon: 26.16 },
  { id: "jhb", name: "Johannesburg", region: "SA", lat: -26.20, lon: 28.05 },
  { id: "durban", name: "Durban", region: "SA", lat: -29.86, lon: 31.02 },
  { id: "cpt", name: "Cape Town", region: "SA", lat: -33.92, lon: 18.42 },
  { id: "pta", name: "Pretoria", region: "SA", lat: -25.75, lon: 28.19 },
];

export const CITY_BY_ID: Record<string, City> = Object.fromEntries(CITIES.map((c) => [c.id, c]));

// Road-distance overrides for known corridors (km one-way). Simulates the
// Distance Matrix API — critical for highland routes where straight-line
// distance drastically undercounts real drive distance.
export const ROAD_OVERRIDES: Record<string, { km: number; hours: number; requires4x4?: boolean; border?: boolean }> = {
  "maseru|thaba-tseka": { km: 180, hours: 3.5, requires4x4: true },
  "maseru|mokhotlong": { km: 270, hours: 5.5, requires4x4: true },
  "maseru|qacha": { km: 260, hours: 5, requires4x4: true },
  "thaba-tseka|mokhotlong": { km: 130, hours: 3, requires4x4: true },
  "maseru|leribe": { km: 90, hours: 1.3 },
  "maseru|mafeteng": { km: 76, hours: 1.1 },
  "maseru|mohales-hoek": { km: 125, hours: 1.7 },
  "maseru|quthing": { km: 185, hours: 2.6 },
  "maseru|bloem": { km: 155, hours: 2, border: true },
  "maseru|jhb": { km: 440, hours: 5.2, border: true },
  "maseru|pta": { km: 480, hours: 5.5, border: true },
  "maseru|durban": { km: 640, hours: 7.5, border: true },
  "maseru|cpt": { km: 1180, hours: 13, border: true },
  "bloem|jhb": { km: 400, hours: 4, border: false },
  "bloem|cpt": { km: 1000, hours: 10.5 },
};

export interface FuelPrice {
  region: "LS" | "SA";
  pricePerLitre: number; // in local (pegged) currency
  updated: string;
}

export const FUEL_PRICES: Record<"LS" | "SA", FuelPrice> = {
  LS: { region: "LS", pricePerLitre: 22.10, updated: "2026-06-01" },
  SA: { region: "SA", pricePerLitre: 23.45, updated: "2026-06-01" },
};

export const BORDER_FEE = 350; // flat cross-border adder

export interface Artist {
  id: string;
  name: string;
  tagline: string;
  homeCityId: string;
  basePerformanceFee: number; // full band, private, 60min baseline
  photo: string; // emoji sigil for demo
  driverAllowance: number;
  perDiem: number;
  accomPerRoom: number;
  proximityWindowDays: number;
  proximityRadiusKm: number;
  discountPolicy: "full" | "capped" | "off";
  discountCapPct?: number;
}

export const ARTISTS: Artist[] = [
  {
    id: "stunna",
    name: "Ntate Stunna",
    tagline: "Free-Strata · double SAMA winner · anchor artist",
    homeCityId: "maseru",
    basePerformanceFee: 50000,
    photo: "◆",
    driverAllowance: 500,
    perDiem: 450,
    accomPerRoom: 900,
    proximityWindowDays: 3,
    proximityRadiusKm: 150,
    discountPolicy: "full",
  },
  {
    id: "nthabi",
    name: "Nthabi Sings",
    tagline: "Vocalist · featured on the Penya Play catalogue",
    homeCityId: "maseru",
    basePerformanceFee: 30000,
    photo: "✦",
    driverAllowance: 500,
    perDiem: 450,
    accomPerRoom: 900,
    proximityWindowDays: 3,
    proximityRadiusKm: 150,
    discountPolicy: "full",
  },
];

export interface ConfirmedBooking {
  id: string;
  artistId: string;
  cityId: string;
  date: string; // ISO
  label: string;
}

// Seed the proximity engine with a few confirmed dates so the demo
// visibly triggers a discount when a booker picks a nearby venue.
export const CONFIRMED_BOOKINGS: ConfirmedBooking[] = [
  { id: "b1", artistId: "stunna", cityId: "thaba-tseka", date: "2026-07-24", label: "District festival" },
  { id: "b2", artistId: "stunna", cityId: "bloem", date: "2026-08-15", label: "Corporate gala" },
  { id: "b3", artistId: "nthabi", cityId: "leribe", date: "2026-07-18", label: "Wedding" },
  { id: "b4", artistId: "nthabi", cityId: "thaba-tseka", date: "2026-08-08", label: "Cultural day" },
];

export const SET_LENGTHS = [30, 45, 60, 90] as const;
export type SetLength = (typeof SET_LENGTHS)[number];

export function setLengthMultiplier(len: SetLength): number {
  return { 30: 0.7, 45: 0.85, 60: 1.0, 90: 1.35 }[len];
}

// Peak windows — Uber-style surge for high-demand dates.
export const PEAK_WINDOWS: { start: string; end: string; label: string; multiplier: number }[] = [
  { start: "2026-12-15", end: "2027-01-02", label: "Festive season", multiplier: 1.4 },
  { start: "2026-04-03", end: "2026-04-06", label: "Easter", multiplier: 1.2 },
];
