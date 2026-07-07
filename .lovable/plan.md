
## Goal

Make the **public-facing side** of Penya Play (landing, booking form, confirmation, deposit page, auth) feel like a Gen-Z entertainment brand — cinematic gold-on-black, alive with scroll motion, unmistakably PenyaPlay. Admin stays as-is (pro/dense).

Not a total re-architecture — a targeted visual + motion pass grounded in the uploaded logo.

## Brand identity (locked)

- **Logo**: uploaded PenyaPlay mark (gold on black, film-reel + play-triangle monogram). Upload to Lovable Assets, use everywhere (nav, favicon, confirmation, deposit invoice, OG image).
- **Palette** (updates `src/styles.css` tokens):
  - Background `#05050A` (near-black with blue undertone, not pure `#000`)
  - Surface `#0D0D14`
  - Gold primary `#E8C56A` → `#F5D97A` (gradient stop)
  - Gold deep `#B8912F`
  - Cream text `#F5F1E6`
  - Muted `#7A7566`
  - Accent (rare, for status pops): warm coral `#FF6B4A`
- **Type**:
  - Display: **Bricolage Grotesque** (chunky, geometric, Gen-Z, variable weight) — for hero, section titles, big stats
  - Body: **Inter Tight** — dense info, forms
  - Numeric: `tabular-nums` on all prices/refs
- **Texture**: subtle film-grain overlay, soft gold radial gloom behind hero, hairline gold dividers, generous negative space, `oklch()` gold gradients.

## Motion system (Gen-Z scroll feel)

Add **Motion for React** (`motion/react`) + a lightweight scroll driver. No parallax overkill — controlled, cinematic moments:

1. **Hero reveal** — logo scales down + settles as you scroll, title splits into words that stagger up.
2. **Sticky story sections** — pin-and-swap slides ("Book any Penya artist → in minutes → with confidence") using `useScroll` + transform on a pinned container.
3. **Marquee** — infinite horizontal scroll of past events / cities, gold hairline top and bottom.
4. **Reveal-on-view** — every card fades + rises 20px when it enters viewport (staggered).
5. **Number tickers** — bookings closed / cities toured / artists managed count up on view.
6. **Cursor spotlight** (desktop only) — subtle gold radial follows cursor on the hero.
7. **Bento-grid tilt** — feature cards tilt slightly on mouse-move.
8. **Booking form** — steps slide horizontally with spring transitions instead of the current instant swap. Progress bar is a gold liquid fill.

Mobile-first: every effect degrades gracefully on `prefers-reduced-motion` and small viewports.

## Scope — what changes

### Public routes (redesigned)
- `/` landing — new hero, sticky story sections, artists roster strip, bento features, marquee, big-CTA footer.
- `/book` — same 5-step form logic, new spring-transitions between steps, gold liquid progress bar, refreshed inputs.
- `/book/confirm/$ref` — cinematic "You're in" screen with animated ref and confetti-gold burst.
- `/pay/$ref` — invoice card with animated total, gold-bordered POP upload dropzone.
- `/auth` — dark cinematic split-screen with the logo hero on the left.

### Global
- `src/styles.css` — new tokens, `@theme` update, font @import via `<link>` in `__root.tsx`, grain utility.
- `src/routes/__root.tsx` — Bricolage + Inter Tight `<link>` tags, favicon swap, updated title/description/og.
- New `public/favicon.png` (from uploaded logo, background removed).
- New shared components: `<GoldButton>`, `<MarqueeStrip>`, `<StickyStorySection>`, `<RevealOnView>`, `<NumberTicker>`, `<GrainOverlay>`, `<LogoMark>`.
- OG image: gold-on-black hero cover generated once (1200×630) via image gen, wired into leaf-route `head()`.

### Admin (untouched)
Admin under `/_authenticated/admin/*` keeps its current pro/dense chrome. Only inherits the new brand tokens (so buttons and links use the new gold), but no marketing motion.

## Deliverable order (single build turn)

1. Upload logo → Lovable Assets → favicon + component reference.
2. Update `src/styles.css` tokens + fonts + grain utility.
3. Update `__root.tsx` head (fonts, favicon, brand title/description, OG on leaf routes).
4. Install `motion` (`bun add motion`) + build motion primitives.
5. Rebuild `/` landing.
6. Restyle `/book`, `/book/confirm/$ref`, `/pay/$ref`, `/auth`.
7. Generate + wire OG image on the landing route.
8. Verify: mobile viewport (440×799), desktop (1440), `prefers-reduced-motion` respected.

## Out of scope (explicitly deferred)

- Booking Journey timeline / WhatsApp orchestration (previous message — will be next milestone).
- Admin visual redesign.
- Video hero (would need a real reel; can slot in later).
- 3D / WebGL (overkill for this pass; motion + gradients hit the same vibe faster).

## Open call — confirm before I build

- **Logo variants**: do you have a horizontal lockup and a monogram-only version, or should I derive them from the uploaded square?
- **Video reel**: any short performance clip I should embed in the hero (silent, autoplay)? If not, I'll build with static + motion.
- **Artist roster**: is Ntate Stunna the only public-facing artist for now, or do I put "and more" placeholder cards for future artists?

Reply with any adjustments and I'll implement.
