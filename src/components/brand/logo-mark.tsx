import logoAsset from "@/assets/penya-play-logo.jpg.asset.json";

interface LogoMarkProps {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

/**
 * PenyaPlay brand mark. Renders the film-reel + play monogram
 * from the CDN with rounded gold frame.
 */
export function LogoMark({ size = 44, className = "", alt = "Penya Play", priority = false }: LogoMarkProps) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-primary/30 ${className}`}
      style={{ width: size, height: size }}
      aria-label={alt}
    >
      <img
        src={logoAsset.url}
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </span>
  );
}

/** Wordmark: monogram + PENYA PLAY typography lockup */
export function LogoLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={40} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[15px] font-bold tracking-[0.15em] text-foreground">
          PENYA<span className="text-primary">PLAY</span>
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
          Booking OS
        </span>
      </span>
    </span>
  );
}
