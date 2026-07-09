"use client";
/**
 * Stage-inspired ornamental elements echoing the cinematic arena refs:
 *  - StageFloor: concentric gold rings suggesting a spotlit performance platform.
 *  - LightShafts: vertical volumetric gold beams behind section headers.
 */

export function StageFloor({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden ${className}`}
    >
      {/* Floor glow */}
      <div
        className="absolute bottom-0 left-1/2 h-[220px] w-[140%] -translate-x-1/2 translate-y-1/3"
        style={{
          background:
            "radial-gradient(ellipse 50% 100% at 50% 100%, oklch(0.82 0.14 88 / 0.35), transparent 70%)",
          filter: "blur(8px)",
        }}
      />
      {/* Concentric rings */}
      <svg
        viewBox="0 0 800 240"
        preserveAspectRatio="xMidYMax slice"
        className="relative h-[240px] w-full"
      >
        <defs>
          <linearGradient id="stage-ring" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.82 0.14 88)" stopOpacity="0" />
            <stop offset="50%" stopColor="oklch(0.92 0.14 90)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 88)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[420, 340, 270, 210, 160, 120, 90].map((r, i) => (
          <ellipse
            key={i}
            cx="400"
            cy="240"
            rx={r}
            ry={r * 0.22}
            fill="none"
            stroke="url(#stage-ring)"
            strokeWidth={i === 0 ? 1.4 : 0.7}
            opacity={0.85 - i * 0.09}
          />
        ))}
        {/* Center hotspot */}
        <ellipse cx="400" cy="240" rx="40" ry="9" fill="oklch(0.95 0.12 90)" opacity="0.5" />
      </svg>
    </div>
  );
}

export function LightShafts({
  count = 3,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  const positions =
    count === 5
      ? [12, 30, 50, 70, 88]
      : count === 4
        ? [18, 40, 60, 82]
        : [22, 50, 78];
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {positions.map((left, i) => (
        <span
          key={i}
          className="absolute top-0 h-full w-[90px] mix-blend-screen"
          style={{
            left: `${left}%`,
            transform: "translateX(-50%) skewX(-6deg)",
            background:
              "linear-gradient(180deg, oklch(0.82 0.14 88 / 0.32) 0%, oklch(0.82 0.14 88 / 0.10) 40%, transparent 85%)",
            filter: "blur(14px)",
            opacity: 0.6,
            animation: `constellation-twinkle ${6 + i * 1.4}s ease-in-out ${i * 0.6}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
