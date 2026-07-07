// Penya Booking Score — deterministic v1.
// 0–100. Breakdown returned so admins can see WHY a booking scored what it did.

export interface ScoreInput {
  budgetMin?: number | null;
  clientOffer?: number | null;
  packageBasePrice: number;
  depositReady: boolean;
  companyProvided: boolean;
  crowdSize?: number | null;
  ticketPrice?: number | null;
  hasSponsors: boolean;
  hasMedia: boolean;
  distanceKm: number; // rough distance from Maseru
  daysOut: number; // days between now and event
  isRepeatPromoter: boolean;
  promoterReliability: number; // 0..100, 50 = unknown
  blacklisted: boolean;
  proofLinkProvided: boolean;
}

export interface ScoreBreakdown {
  total: number;
  band: "hot" | "warm" | "cool" | "cold";
  parts: {
    financial: number;
    brand: number;
    logistics: number;
    strategic: number;
    risk: number;
  };
  notes: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function computeScore(i: ScoreInput): ScoreBreakdown {
  const notes: string[] = [];

  // Financial /30
  let financial = 0;
  const budget = i.clientOffer ?? i.budgetMin ?? 0;
  if (budget >= i.packageBasePrice * 1.1) {
    financial += 18;
    notes.push("Budget meets or exceeds package price");
  } else if (budget >= i.packageBasePrice * 0.8) {
    financial += 12;
    notes.push("Budget within 80% of package price");
  } else if (budget > 0) {
    financial += 4;
    notes.push("Budget below package baseline — negotiation likely");
  }
  if (i.depositReady) {
    financial += 8;
    notes.push("Promoter confirms deposit-ready");
  }
  if (i.companyProvided) financial += 4;

  // Brand /20
  let brand = 0;
  if (i.crowdSize) {
    if (i.crowdSize >= 5000) brand += 12;
    else if (i.crowdSize >= 1500) brand += 8;
    else if (i.crowdSize >= 500) brand += 5;
    else brand += 2;
  }
  if (i.hasSponsors) {
    brand += 4;
    notes.push("Sponsors attached");
  }
  if (i.hasMedia) {
    brand += 4;
    notes.push("Media / broadcast exposure");
  }

  // Logistics /20
  let logistics = 0;
  if (i.distanceKm <= 100) logistics += 10;
  else if (i.distanceKm <= 300) logistics += 7;
  else if (i.distanceKm <= 600) logistics += 4;
  else logistics += 1;
  if (i.daysOut >= 21) logistics += 8;
  else if (i.daysOut >= 10) logistics += 5;
  else if (i.daysOut >= 5) logistics += 2;
  else {
    logistics += 0;
    notes.push("Short lead time — urgency premium may apply");
  }

  // Strategic /20
  let strategic = 0;
  if (i.isRepeatPromoter) {
    strategic += 12;
    notes.push("Repeat promoter — relationship value");
  } else {
    strategic += 6;
  }
  if (i.proofLinkProvided) strategic += 4;
  if (i.hasSponsors && i.hasMedia) strategic += 4;

  // Risk /10 (subtracted; starts full)
  let risk = 10;
  if (i.blacklisted) {
    risk = 0;
    notes.push("⚠ Promoter is blacklisted");
  } else {
    if (i.promoterReliability < 40) {
      risk -= 6;
      notes.push("Low promoter reliability");
    } else if (i.promoterReliability < 60) {
      risk -= 3;
    }
    if (!i.proofLinkProvided) risk -= 2;
  }

  financial = clamp(financial, 0, 30);
  brand = clamp(brand, 0, 20);
  logistics = clamp(logistics, 0, 20);
  strategic = clamp(strategic, 0, 20);
  risk = clamp(risk, 0, 10);

  const total = financial + brand + logistics + strategic + risk;
  const band: ScoreBreakdown["band"] =
    total >= 85 ? "hot" : total >= 65 ? "warm" : total >= 45 ? "cool" : "cold";

  return { total, band, parts: { financial, brand, logistics, strategic, risk }, notes };
}

export function bandLabel(band: ScoreBreakdown["band"]) {
  return {
    hot: { label: "Hot lead — accept fast", color: "text-green-400 bg-green-500/10 border-green-500/30" },
    warm: { label: "Warm — negotiate", color: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30" },
    cool: { label: "Cool — needs guarantees", color: "text-orange-300 bg-orange-500/10 border-orange-500/30" },
    cold: { label: "Cold — likely decline", color: "text-red-300 bg-red-500/10 border-red-500/30" },
  }[band];
}

// Rough km lookup for common cities (used until we upgrade to a real distance API).
export const KM_FROM_MASERU: Record<string, number> = {
  maseru: 0, leribe: 90, mafeteng: 76, "mohale's hoek": 125, quthing: 185,
  "thaba-tseka": 180, mokhotlong: 270, "qacha's nek": 260,
  bloemfontein: 155, johannesburg: 440, pretoria: 480, durban: 640, "cape town": 1180,
  welkom: 260, kimberley: 340, "qwaqwa": 200,
};

export function guessDistanceKm(city: string): number {
  const key = city.trim().toLowerCase();
  if (key in KM_FROM_MASERU) return KM_FROM_MASERU[key];
  // Fallback: assume mid-range trip
  return 350;
}
