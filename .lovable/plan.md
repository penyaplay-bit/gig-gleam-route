
# Penya Play Booking OS — Foundation (Turn 1)

Everything below ships in this turn. Everything not listed is scheduled for later turns and called out at the end.

## 1. Enable Lovable Cloud
Backend + auth + file storage + AI Gateway (used in later turns for the AI assistant).

## 2. Database schema

Multi-artist ready from day one — every booking, package, and pricing rule is scoped to `artist_id`.

```text
app_role (enum)          admin, staff
booking_status (enum)    new, reviewing, quote_sent, offer_submitted,
                         counter_offer, deposit_pending, confirmed,
                         completed, cancelled, declined
booking_score_band       hot, warm, cool, cold

user_roles               user_id, role                    (RLS via has_role)
artists                  id, name, slug, home_city, base_fee, active
packages                 id, artist_id, name, description, base_price, active
pricing_rules            id, artist_id, key, value_json   (fuel, per-diem, etc.)
promoters                id, name, company, phone, whatsapp, email,
                         country, reliability_score, notes,
                         total_revenue, bookings_count, blacklisted
bookings                 id, ref, artist_id, promoter_id, event_type,
                         event_name, venue, city, country, event_date,
                         start_time, end_time, crowd_size, ticket_price,
                         package_id, client_offer, description,
                         status, score, score_breakdown_json,
                         quoted_amount, deposit_pct, deposit_amount,
                         balance_amount, created_at, updated_at
booking_notes            id, booking_id, author_id, body, internal, created_at
deposits                 id, booking_id, amount, pop_path (storage),
                         uploaded_at, verified_at, verified_by, status
```

Every table gets explicit `GRANT`s + RLS. Public can INSERT bookings/promoters (submission), only admins can read/update. Deposits POP bucket is private with owner-read + admin-read.

## 3. Auth

- Email/password + Google sign-in.
- New signups have no role. Admin must be granted via `user_roles` (seeded for first user via a one-off migration + UI hint).
- Managed `_authenticated` layout gates `/admin/*`.

## 4. Routes

```text
/                          Landing + "Request a booking" CTA
/book                      Multi-step public booking form
/book/confirm/$ref         Confirmation with reference number + status
/auth                      Sign-in / sign-up (admin only, positioned as staff login)
/pay/$ref                  Public deposit page: shows invoice, POP upload

/_authenticated/admin                Redirect → /admin/pipeline
/_authenticated/admin/pipeline       Kanban by status
/_authenticated/admin/bookings       Table view + filters
/_authenticated/admin/bookings/$id   Detail: status, quote, notes, POP verify
/_authenticated/admin/calendar       Month view w/ conflict warnings
/_authenticated/admin/packages       Manage packages
/_authenticated/admin/promoters      CRM list
```

## 5. Public booking form

Multi-step, mobile-first, dark/gold Penya identity kept from current design.
Steps: Event → Logistics → Package/Offer → Contact → Review.
Extra qualifying fields per your stress test: minimum-budget confirmation, deposit readiness, event social/proof link, "serious bookings only" copy.

On submit:
- Upsert promoter by email
- Create booking with generated ref (`PP-XXXXXX`)
- Compute Penya Booking Score (0–100) with breakdown JSON
- Status `new`
- Redirect to `/book/confirm/$ref`

## 6. Penya Booking Score v1

Deterministic scoring (AI-assisted refinement later):

```text
Financial (30)   budget vs package price, deposit readiness, company type
Brand (20)       crowd size, ticket price, sponsor/media flags
Logistics (20)   distance from Maseru, days out, weekday/weekend
Strategic (20)   repeat promoter bonus, new market bonus
Risk (10)        unknown promoter, blacklist proximity, low reliability
```

Band + color rendered everywhere the booking appears.

## 7. Admin pipeline + detail

- Pipeline: columns per status, cards show ref, artist, date, city, score band, quoted amount.
- Detail page: full booking, promoter history, quote builder (reuses existing quote engine), status transitions, internal notes, deposit panel.
- Calendar conflict detection: same-date bookings for same artist flagged red; same-weekend flagged amber; nearby-city same-week flagged as opportunity.

## 8. Quote engine

Port the existing `src/lib/quote-engine.ts` logic into a server function that reads `pricing_rules` + `packages` from Cloud instead of `mock-data.ts`. Quote total, breakdown JSON, deposit % and amount stored on booking.

## 9. Deposit → Confirmed flow (the "no payment = no booking" rule)

1. Admin sends quote → status `quote_sent`.
2. Promoter accepts (admin marks accepted, or later: public accept link) → status `deposit_pending`, deposit invoice generated.
3. Promoter uploads POP at `/pay/$ref` → row in `deposits`, status stays `deposit_pending`, admin notified.
4. Admin opens booking, previews POP, clicks **Verify deposit** → deposit row verified, booking → `confirmed`.
5. No manual "confirm" button anywhere without a verified deposit.

## 10. Design

Keep current premium dark + warm-gold + cream tokens from `src/styles.css`. Extend with:
- Pipeline column tints
- Score band chips (hot/warm/cool/cold)
- Status pill palette (10 statuses, distinct tones)
- Admin shell (sidebar nav, top bar w/ artist switcher scaffold — single artist seeded, dropdown UI in place)

## 11. Seed data

Migration inserts Ntate Stunna as `artists[0]`, ports the 7 default packages, and inserts the current pricing rules. First signed-up user is auto-granted `admin` (documented in a note; not automatic — a small SQL snippet the user runs, to keep it safe).

---

## Explicitly deferred to later turns (called out so you can prioritize next)

- Tour Intelligence suggestions (needs a few bookings in DB to be useful)
- AI Assistant (summarize/predict/draft — hooked to Lovable AI in a later turn)
- Negotiation assistant with historical data
- Automated WhatsApp/email reminders (wa.me deep links ship now; scheduled sends need a WA provider decision)
- Financial dashboard (P&L per booking)
- Artist readiness checklist (rider, call sheet, flights…)
- Contract PDF generation (quote PDF stays; contract PDF is new)
- Multi-artist admin UI (schema supports it; the artist-picker UI ships as a stub — full flows next)
- Blacklist enforcement UI (column exists; screens later)
- Learning pricing engine (needs historical accepted quotes)

## Technical notes

- All Supabase writes go through `createServerFn` + `requireSupabaseAuth` (admin actions) or public server routes (booking submit, POP upload) with Zod validation.
- POP uploads → private `deposits` storage bucket; signed URLs for admin preview.
- Route data uses TanStack Query `queryOptions` + `useSuspenseQuery`.
- Existing `src/routes/index.tsx` quote-calculator UI is replaced by the new landing page; the quote engine logic is preserved server-side.
- Old `quote-pdf.ts` / `quote-terms.ts` kept and reused from admin detail page for now.

Approve and I ship it.
