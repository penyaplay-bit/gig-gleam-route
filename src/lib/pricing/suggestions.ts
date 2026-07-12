// Pure client-side advisory suggestions. No AI calls, no auto-apply.
// Rendered as dismissible cards; user always decides.
export type PricingProfile = {
  standard_price_cents: number | null;
  weekday_price_enabled: boolean | null;
  growth_price_enabled: boolean | null;
  last_minute_enabled: boolean | null;
  tour_price_enabled: boolean | null;
  currency: string | null;
} | null;

export type PerformanceLite = {
  event_date: string;
  city: string | null;
  fee_private: number | null;
  status: string | null;
};

export type Suggestion = {
  id: string;
  kind:
    | "enable_weekday"
    | "use_growth_price"
    | "enable_last_minute"
    | "update_standard"
    | "enable_touring";
  title: string;
  body: string;
  target: "weekday" | "growth" | "last_minute" | "standard" | "tour";
};

function daysUntil(d: string): number {
  const target = new Date(d + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.round((target - now) / 86_400_000);
}

export function deriveSuggestions(
  profile: PricingProfile,
  performances: PerformanceLite[],
): Suggestion[] {
  if (!profile) return [];
  const out: Suggestion[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const upcoming = performances.filter(
    (p) => p.event_date >= today && p.event_date <= in30,
  );
  const bookedDates = new Set(upcoming.map((p) => p.event_date));

  // 1. Weekday capacity: count unbooked weekdays in next 30 days
  let unbookedWeekdays = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 4) {
      const iso = d.toISOString().slice(0, 10);
      if (!bookedDates.has(iso)) unbookedWeekdays += 1;
    }
  }
  if (unbookedWeekdays >= 15 && !profile.weekday_price_enabled) {
    out.push({
      id: "sug-weekday",
      kind: "enable_weekday",
      target: "weekday",
      title: "Consider a weekday rate",
      body: `You have several open weekdays this month. Enabling a weekday rate can surface more midweek bookings — you decide the amount.`,
    });
  }

  // 2. Growth price: any upcoming booking in a city not in past history
  const pastCities = new Set(
    performances
      .filter((p) => p.event_date < today && p.city)
      .map((p) => p.city!.trim().toLowerCase()),
  );
  const newCityUpcoming = upcoming.find(
    (p) => p.city && !pastCities.has(p.city.trim().toLowerCase()),
  );
  if (newCityUpcoming && !profile.growth_price_enabled) {
    out.push({
      id: "sug-growth",
      kind: "use_growth_price",
      target: "growth",
      title: `New market: ${newCityUpcoming.city}`,
      body: `You have an upcoming performance in a city that isn't in your history. A Growth Price can help you accept early opportunities in new markets — internal only, never shown publicly.`,
    });
  }

  // 3. Last-minute this weekend
  const thisSat = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const satBooked = bookedDates.has(thisSat);
  const daysToSat = daysUntil(thisSat);
  if (!satBooked && daysToSat >= 0 && daysToSat <= 5 && !profile.last_minute_enabled) {
    out.push({
      id: "sug-lastminute",
      kind: "enable_last_minute",
      target: "last_minute",
      title: "This weekend is open",
      body: `Enable a last-minute discount to signal you're available for weekend bookings placed inside your chosen window.`,
    });
  }

  // 4. Standard rate review — recent avg well above stored standard
  if (typeof profile.standard_price_cents === "number" && profile.standard_price_cents > 0) {
    const in90past = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const paid = performances.filter(
      (p) => p.event_date >= in90past && p.event_date < today && typeof p.fee_private === "number",
    );
    if (paid.length >= 3) {
      const avg =
        paid.reduce((s, p) => s + (p.fee_private ?? 0), 0) / paid.length;
      if (avg > profile.standard_price_cents * 1.1) {
        out.push({
          id: "sug-standard",
          kind: "update_standard",
          target: "standard",
          title: "You're earning above your standard rate",
          body: `Recent bookings averaged higher than your saved Standard Booking Price. You may want to update it — your decision.`,
        });
      }
    }
  }

  return out;
}
