import logoPicture from "@/assets/penya-play-logo.picture.json";
import { Picture } from "@/components/brand/picture";

interface LogoMarkProps {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

/**
 * PenyaPlay brand mark. Renders the film-reel + play monogram
 * from the CDN with rounded gold frame. Serves AVIF/WebP with JPG fallback.
 */
export function LogoMark({ size = 44, className = "", alt = "Penya Play", priority = false }: LogoMarkProps) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-primary/30 ${className}`}
      style={{ width: size, height: size }}
      aria-label={alt}
    >
      <Picture
        manifest={logoPicture}
        alt={alt}
        sizes={`${size}px`}
        width={size}
        height={size}
        priority={priority}
        className="block h-full w-full"
        imgClassName="h-full w-full object-cover"
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
