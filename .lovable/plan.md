## Penya Play — Progressive Trust & Friendly Booking

Layer risk-based verification onto the existing app. Nothing about auth, bookings, gigs, or the intelligence engine is rebuilt — we add a trust level per user, gate specific actions by level, and reshape the top of the booking funnel so casual buyers (Thato) never see "identity verification required."

### Core model

Add a single `trust_level` per user (0 Visitor → 1 Contact Verified → 2 ID Verified → 3 Business Verified) plus a separate `performer_trust` track for people receiving money. Every gated action checks the level; UI badges are derived, not hand-managed.

New tables (all additive):
- `user_trust` — level, phone_verified_at, email_verified_at, id_verified_at, id_provider, risk_flags[]
- `performer_trust` — payout_identity_verified, bank_verified, background_check_status, family_event_verified, references_count
- `trust_events` — audit log (otp_sent, otp_failed, id_submitted, risk_flag_raised, level_promoted)
- `risk_signals` — per-request signals (ip, ua_hash, disposable_email, duplicate_device, honeypot_hit) for the fraud checks

### Slices (ship independently)

**T1 — Guest browsing + friendly funnel top**
- Home reshapes to "What are you planning?" → event type → performer type → results.
- Public routes for browse/search/profile (no auth wall). Save/enquire buttons render an inline "Verify your number to enquire" sheet, never a hard redirect.
- Verified-performer badges surface on cards (Identity, Family Event, Payment Protected, Booking History, Highly Rated). Tap = plain-language explainer.

**T2 — Level 1: Contact verified (OTP + email)**
- Phone OTP via Supabase Auth (SMS provider — needs one selected; Twilio is the common default).
- Email verification link (already available via Supabase).
- Invisible bot defence: honeypot field, submission-rate limit table, Cloudflare Turnstile (or hCaptcha) on the enquire form.
- Friendly copy: "Quick safety check — we'll send a code to confirm you're a real person."
- Unlocks: send enquiries, save performers, receive quotes, book low-value private events (threshold configurable, e.g. R10 000).

**T3 — Level 2: ID verified (risk-triggered only)**
- Triggered by: booking value ≥ threshold, ≥ N bookings in 24h, international travel, venue security flag, refund/credit request, risk_signals score.
- ID + selfie/liveness via a third-party (Stripe Identity / Veriff / Onfido — pick one; Stripe Identity is simplest if you're already on Stripe).
- Payment-method verification (small auth hold).
- Never asked speculatively; always tied to a specific action with a reason chip ("This booking is R25 000 — one quick ID check keeps the deposit protected").

**T4 — Level 3: Business verified**
- Manual review flow in the existing admin (`/admin/verify` already exists — extend).
- Fields: business reg number, authorized rep, business email/phone, bank details, venue/company ownership doc.
- Auto-applied to promoter/venue/agency/brand kinds.

**T5 — Performer trust track (separate from buyer levels)**
- Phone + email + legal ID before first payout.
- Bank account verification (micro-deposit or provider verification).
- Featured-performance evidence + professional-name claim (already have `featured_performance_url`).
- Optional/required background check for `children_entertainment` categories → grants **Family Event Verified** badge (never granted for ID upload alone).
- Explicit policy: performers must never privately contact minors; surfaced in T&Cs + message-scanning warning.

**T6 — Fraud + safety signals**
- Pre-booking: disposable-email list, repeated OTP failures, IP velocity, duplicate-device fingerprinting, photo-hash duplicate detection on performer uploads, name↔bank mismatch, sudden payout-detail changes.
- During booking: warn banner when messages contain external payment links / phone numbers / off-platform payment keywords: "Stay protected — payments made outside Penya Play may not qualify for booking support."
- Pre-payout: identity + bank verified, performance completed, no active dispute, 2FA for large withdrawals.

**T7 — Deposit UX simplification**
- Replace escrow/wallet jargon on buyer surfaces with:
  ```
  Booking total: R2,000
  Deposit today:  R600
  Balance due:  R1,400
  Payment protected by Penya Play
  ```
- Escrow mechanics stay under the hood; the words "escrow", "ledger", "settlement" only appear in admin / performer wallet views.

**T8 — Copyright safety on character performers**
- Marketplace category names: "Spider Hero", "Web Hero", "Red-and-Blue Hero Performer" (never "Spider-Man" unless licensing proof uploaded and verified).
- Performer profile enum + validation on category selection.

**T9 — Reach integration finish-line** (from the previous turn)
- Spotify + YouTube already wired at DB + server-fn level. This slice adds the profile UI (search & link Spotify artist, paste YouTube handle, manual IG/TikTok) + surfaces `spotify_followers` / `monthly_listeners_est` / `youtube_subscribers` on the performer card and in the AI booking suggestions ("Top listeners in Johannesburg — worth targeting for a tour date").

### Technical notes

- Migrations additive, 4-step pattern (CREATE → GRANT → RLS → POLICY), owner-scoped policies + service_role grants.
- `trust_level` is a derived view over `user_trust` verification timestamps + `performer_trust` flags — no hand-editing.
- Every gated server fn calls a `requireTrustLevel(context, minLevel, action)` helper that throws a typed error the client renders as an inline verification sheet, not a redirect.
- SMS OTP + ID provider + Turnstile are third-party — I'll ask for credentials only when you approve the slice that needs them.
- Existing `/admin/verify` extended, not replaced.

### Suggested order

Ship T1 + T2 + T7 + T8 together (visible experience upgrade for Thato; unlocks bookings without ID walls). Then T5 (performer trust) + T6 (fraud signals). Then T3 (Level 2 ID). T4 (business) + T9 (reach UI) in parallel afterwards.

### Open questions

1. **SMS provider** for OTP — Twilio, MessageBird, Vonage, or the SMS provider already wired into your Supabase auth? Needed for T2.
2. **ID verification provider** for T3 — Stripe Identity (easiest if you'll also use Stripe payments), Veriff, or Onfido?
3. **Level 1 → Level 2 trigger threshold** — auto-require ID above R X booking value? Suggest R25 000 as default.
4. **Family Event Verified** — require full criminal-record check (weeks, costs money, high friction) or references + attestation for v1, upgrade later?
5. Start with **T1+T2+T7+T8** as one bundle (the "Thato experience"), or split T1+T7+T8 (visible frontend now) from T2 (which needs the SMS provider decision)?
