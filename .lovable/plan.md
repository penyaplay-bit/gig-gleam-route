# Scroll-scrub video section on landing page

Add a new full-viewport section on `/` where the uploaded video's playback is tied to scroll position — scroll down scrubs frames forward, scroll up scrubs backward. Apple-product-page style.

## What ships

- New section `<ScrollScrubVideo />` inserted on the landing route below the current hero.
- Uploaded MP4 becomes a Lovable CDN asset (pointer JSON in `src/assets/`), served with the correct headers for frame seeking.
- Section is a tall scroll container (≈ 300vh) with an inner `sticky` viewport-sized stage holding the video.
- As the container scrolls through the viewport, the video's `currentTime` is set to `progress × duration` on every `scroll` / `rAF` tick. No autoplay, muted, `playsInline`, `preload="auto"`.
- Overlaid title + subline that fade/translate through the scrub (headline at start, subline mid, small caption at end) so the section tells a short story, not just plays a clip.
- Works on desktop and mobile; on very slow connections the video shows a poster frame until enough has buffered.

## Technical notes

- Asset pipeline: upload via `lovable-assets create --file /mnt/user-uploads/...mp4 --filename scroll-hero.mp4` → import pointer, use `.url`.
- Scrubbing hook: local `useScrollScrub(ref, videoRef)` — IntersectionObserver to activate, `requestAnimationFrame` loop while in view, updates `video.currentTime` from `getBoundingClientRect()` progress. Cleans up on unmount.
- Safari needs `video.preload = 'auto'`, `playsInline`, and `muted`; we set `video.pause()` and never call `play()` — currentTime scrubbing only.
- Three text beats keyed off the same 0→1 progress with `interpolate`-style clamped mapping (no extra libs).
- No new deps. Pure React + Tailwind.
- File layout: `src/components/landing/scroll-scrub-video.tsx`, asset pointer `src/assets/scroll-hero.mp4.asset.json`, imported into the existing landing route (`src/routes/index.tsx`).

## Out of scope

- Frame-image-sequence fallback (heavy; only needed if the MP4 turns out to seek poorly on iOS Safari — can add later).
- Editing the video itself.
- Changes to the existing hero or other sections.