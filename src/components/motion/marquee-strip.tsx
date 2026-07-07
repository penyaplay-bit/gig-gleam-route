import type { ReactNode } from "react";

/**
 * Infinite horizontal marquee. Duplicates the children so the animation loops seamlessly.
 * Pauses when the user prefers reduced motion.
 */
export function MarqueeStrip({
  items,
  className = "",
}: {
  items: ReactNode[];
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-background to-transparent" />
      <div className="marquee flex w-max gap-8 whitespace-nowrap py-3">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-8 text-sm text-muted-foreground">
            {item}
            <span className="text-primary/40">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
