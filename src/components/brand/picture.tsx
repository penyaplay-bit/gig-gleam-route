// Responsive <picture> renderer for CDN-hosted image sets.
// Consumes a .picture.json manifest (AVIF + WebP srcsets + JPG fallback).

export interface PictureSource {
  type: string;
  srcset: { url: string; w: number }[];
}
export interface PictureManifest {
  fallback: string;
  width: number;
  height: number;
  sources: PictureSource[];
}

interface PictureProps {
  manifest: PictureManifest;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

export function Picture({
  manifest,
  alt,
  sizes,
  className = "",
  imgClassName = "",
  priority = false,
  width,
  height,
}: PictureProps) {
  return (
    <picture className={className}>
      {manifest.sources.map((s) => (
        <source
          key={s.type}
          type={s.type}
          sizes={sizes}
          srcSet={s.srcset.map((v) => `${v.url} ${v.w}w`).join(", ")}
        />
      ))}
      <img
        src={manifest.fallback}
        alt={alt}
        width={width ?? manifest.width}
        height={height ?? manifest.height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "low"}
        className={imgClassName}
      />
    </picture>
  );
}
