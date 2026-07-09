"use client";
/**
 * CinematicBackdrop — the reusable premium environment.
 * Gold-on-obsidian, cinematic depth, constellations, light rays, portal rings.
 * Variants:
 *  - "hero"    : full-strength, use once above the fold
 *  - "portal"  : hero + large concentric portal ring behind focal element
 *  - "ambient" : subtle, safe to use behind dashboards / forms
 */
import { useMemo } from "react";

type Variant = "hero" | "portal" | "ambient";

// Deterministic pseudo-random so SSR + client agree.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function CinematicBackdrop({
  variant = "ambient",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const intensity = variant === "ambient" ? 0.45 : 1;
  const rand = useMemo(() => seeded(variant === "hero" ? 7 : variant === "portal" ? 13 : 21), [variant]);

  const particles = useMemo(
    () =>
      Array.from({ length: variant === "ambient" ? 22 : 42 }).map((_, i) => ({
        i,
        left: rand() * 100,
        top: rand() * 100,
        size: 1 + rand() * 2.2,
        delay: rand() * 14,
        dur: 12 + rand() * 18,
        opacity: 0.25 + rand() * 0.6,
      })),
    [rand, variant],
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 14 }).map(() => ({
        x: rand() * 100,
        y: rand() * 100,
        r: 0.6 + rand() * 1.4,
      })),
    [rand],
  );

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity: intensity }}
    >
      {/* Base atmosphere: warm obsidian wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 0%, oklch(0.82 0.14 88 / 0.16), transparent 65%), radial-gradient(ellipse 70% 55% at 50% 100%, oklch(0.55 0.10 75 / 0.14), transparent 60%), linear-gradient(180deg, oklch(0.09 0.010 75) 0%, oklch(0.11 0.012 75) 60%, oklch(0.08 0.010 75) 100%)",
        }}
      />

      {/* Slow-sweeping gold light rays */}
      <div className="absolute inset-0 opacity-70 mix-blend-screen">
        <div
          className="absolute -inset-[20%] animate-[ray-sweep_28s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 90deg at 50% 40%, transparent 0deg, oklch(0.82 0.14 88 / 0.10) 12deg, transparent 30deg, transparent 180deg, oklch(0.82 0.14 88 / 0.08) 200deg, transparent 230deg)",
            filter: "blur(20px)",
          }}
        />
      </div>

      {/* Constellation lines — SVG */}
      <svg
        className="absolute inset-0 h-full w-full opacity-60"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cnst" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.82 0.14 88)" stopOpacity="0" />
            <stop offset="50%" stopColor="oklch(0.82 0.14 88)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 88)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r * 0.15}
            fill="oklch(0.92 0.10 88)"
            style={{
              animation: `constellation-twinkle ${4 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
            }}
          />
        ))}
        {stars.slice(0, 8).map((s, i) => {
          const next = stars[(i + 1) % stars.length];
          return (
            <line
              key={`l-${i}`}
              x1={s.x}
              y1={s.y}
              x2={next.x}
              y2={next.y}
              stroke="url(#cnst)"
              strokeWidth="0.08"
            />
          );
        })}
      </svg>

      {/* Portal rings — only in portal variant */}
      {variant === "portal" && (
        <div className="absolute left-1/2 top-1/2 h-[min(90vw,780px)] w-[min(90vw,780px)] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 animate-[portal-spin_60s_linear_infinite] rounded-full border border-primary/30" />
          <div className="absolute inset-[8%] animate-[portal-spin_90s_linear_infinite_reverse] rounded-full border border-primary/20" />
          <div className="absolute inset-[18%] rounded-full border border-primary/15" />
          <div
            className="absolute inset-[-15%] rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, oklch(0.82 0.14 88 / 0.28), transparent 55%)",
            }}
          />
        </div>
      )}

      {/* Floating gold particles */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.i}
            className="absolute rounded-full bg-primary"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              boxShadow: `0 0 ${p.size * 4}px oklch(0.82 0.14 88 / 0.8)`,
              animation: `particle-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Vignette for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, oklch(0.06 0.008 75 / 0.55) 100%)",
        }}
      />
    </div>
  );
}
