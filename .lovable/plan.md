
# Artist Pricing Engine — Ntate Stunna Standard Booking Template

Turn bookings into a commercial engine. Every quote, payment schedule, rider and contract is generated from a few inputs plus a reusable artist profile. Ntate Stunna ships as the first template, seeded exactly from the Matjhabeng Fashion Week quotation you uploaded.

## Ntate Stunna Standard defaults (matches your PDF exactly)

| Line | Amount |
|---|---|
| Performance Fee | R50,000 |
| Car Hire (2 days @ R3,000) | R6,000 |
| Fuel (est.) | R2,500 |
| Accommodation (1 night, team of 5) | R4,500 |
| **Total** | **R63,000** |
| Booking Payment (R13,000 logistics + 50% fee) | **R38,000** |
| Final Payment (50% fee, ≤7 days before) | **R25,000** |

Rider seeded: Water · Hennessy VSOP x1 / Original x2 + Ginger Ale · Veuve Rich x2 · 5 food platters · Red Bull 6-pack · Ice. Banking details, cancellation clauses (weather / artist / promoter fault), rider compliance, transport, liability — all seeded verbatim from your terms.

## Total formula (additive, corrected)

`Total = Fee + Transport + Accommodation + PerDiem + Equipment + Security + Flights + Taxes − Discounts`

## What you get

- **Artist Profiles** — reusable: base fee, team size, transport/accommodation rules, rider, payment terms, cancellation terms, banking. First profile = Ntate Stunna Standard Booking Template.
- **Booking Intake** — one form: artist, promoter, contact, venue, GPS, country, date, time, attendance, event type, distance (Google Maps), team size, overnight, flights, extra days, security, discount, notes.
- **Auto Cost Engine** — Performance Fee, Transport, Accommodation, Per Diem, Equipment, Security, Flights, Visas, Taxes, Discounts.
- **Smart Distance Rules** — <100 km fuel only · 100–400 km fuel + car hire · >400 km overnight required · cross-border flights.
- **Payment Schedule** — Booking = 100% logistics + 50% fee. Final = 50% fee, auto-clamped to `event_date − 7 days`. Percentages per-artist configurable.
- **Dynamic Rider** — platters, water, drinks, rooms scale with team size.
- **AI Pricing Suggestions** — factors audience, prestige, promoter history, season, risk, availability. Hard profitability floor; below-floor needs explicit admin override with audit trail.
- **One-click Documents** — quotation, invoice, performance contract, hospitality rider, payment schedule, logistics checklist, calendar entry, WhatsApp + email confirmations, finance record. All Penya Play branded.
- **Analytics** — avg booking value, profit/event, logistics cost, promoter LTV, revenue by country/city/promoter/type, conversion rate, avg lead time, cancellation rate.

## Build steps

1. **Schema** — new `artist_profiles` (base_fee, team_size, transport/accommodation/payment/rider/cancellation JSON, banking, profile_version), `quotation_templates`. Extend `event_quotes` with line-item JSON + computed totals + payment schedule. RLS: staff/admin read-write; promoters read own. Seed Ntate Stunna profile + template from your PDF.
2. **Pricing core** — `src/lib/pricing/artist-engine.ts` pure functions: `computeTransport`, `computeAccommodation`, `computePerDiem`, `computeRider`, `computeTotal`, `computePaymentSchedule`. Money in integer cents. Unit-testable.
3. **Server functions** — `src/lib/pricing/quote.functions.ts`: `previewQuote`, `saveQuote`, `generateDocuments`. Auth via `requireSupabaseAuth`.
4. **Google Maps distance** — through the existing gateway (`routes/`) inside a server fn. Cache distance on booking.
5. **AI suggestions** — server fn using Lovable AI (`google/gemini-3-flash-preview`) with structured output. Profitability floor enforced server-side.
6. **UI — Booking Command Centre** at `/_authenticated/admin/bookings/new`:
   - Left: inputs (Event · Location · Logistics · Commercials).
   - Right: live quotation preview — itemised lines, totals, payment schedule, rider preview, AI suggestion card.
   - Bottom: **Generate Documents** → all artefacts in one click.
7. **Documents** — extend `quote-pdf.ts`; add contract, rider, invoice, logistics checklist, WhatsApp/email templates. Penya Play branded.
8. **Analytics page** — `/_authenticated/admin/analytics` with the KPIs (Recharts).

## Technical notes

- Pricing engine is pure TS in `src/lib/pricing/` — no DB, no fetch. Server fns wrap it.
- Artist profile JSON is versioned so old quotes reproduce identically.
- Payment generator returns `[{label, amount, due_date, kind}]`; final clamped to `event_date − 7 days`.
- Google Maps routing calls run server-side through the gateway, never with the browser key.
- AI floor: `min_total = sum(costs) + min_margin_pct × fee`. Suggestions below the floor are rejected server-side; admin can force-override with an audit entry.

## Out of scope this pass

Multi-currency FX, promoter-facing self-serve quoting, e-signature. Easy to add on top afterwards.

Shall I proceed with the build?
