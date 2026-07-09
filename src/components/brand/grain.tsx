/** Fixed film-grain overlay. Mount once at the top of a page.
 * Desktop-only: `mix-blend-mode: overlay` forces full-viewport compositor
 * repaints on every frame — brutal on mobile. */
export function GrainOverlay() {
  return <div className="grain hidden md:block" aria-hidden />;
}
