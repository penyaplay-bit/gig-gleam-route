import { useEffect, useRef, useState } from "react";
import videoAsset from "@/assets/scroll-hero.mp4.asset.json";

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function mapClamp(t: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const p = clamp01((t - inMin) / (inMax - inMin));
  return lerp(outMin, outMax, p);
}

export function ScrollScrubVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Load metadata to get duration
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => setDuration(v.duration || 0);
    if (v.readyState >= 1) onMeta();
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, []);

  // Scroll-driven progress across the pinned section.
  // Drive the video's currentTime from scroll — video ONLY moves when you scroll.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let raf = 0;
    const compute = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const scrolled = -rect.top;
      const p = clamp01(total > 0 ? scrolled / total : 0);
      setProgress(p);
      const v = videoRef.current;
      if (v && duration > 0) {
        const target = p * duration;
        // avoid tiny thrashes
        if (Math.abs(v.currentTime - target) > 0.03) {
          try {
            v.currentTime = target;
          } catch {
            /* some browsers throw before seekable range is ready */
          }
        }
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [duration]);

  // Text beats keyed to scroll progress
  const t1Opacity = mapClamp(progress, 0.0, 0.05, 0, 1) * mapClamp(progress, 0.25, 0.4, 1, 0);
  const t2Opacity = mapClamp(progress, 0.35, 0.5, 0, 1) * mapClamp(progress, 0.6, 0.75, 1, 0);
  const t3Opacity = mapClamp(progress, 0.7, 0.85, 0, 1);
  const t1Y = mapClamp(progress, 0, 0.4, 0, -40);
  const t2Y = mapClamp(progress, 0.35, 0.75, 30, -30);
  const t3Y = mapClamp(progress, 0.7, 1, 40, 0);
  // Slow zoom for cinema feel
  const scale = 1 + mapClamp(progress, 0, 1, 0, 0.08);

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: "300vh" }}
      aria-label="Cinematic scroll"
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoAsset.url}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover opacity-90 will-change-transform"
          style={{ transform: `scale(${scale})` }}
        />


        {/* vignette + wash */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/80" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.85)_100%)]" />

        {/* Text beats */}
        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 text-center">
          <div
            style={{ opacity: t1Opacity, transform: `translateY(${t1Y}px)` }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6"
          >
            <span className="text-[10px] uppercase tracking-[0.35em] text-primary">
              Scroll to enter
            </span>
            <h2 className="mt-4 font-display text-5xl font-black leading-[0.95] text-white sm:text-7xl md:text-8xl">
              The moment,
              <br />
              <span className="text-goldleaf">unfolded.</span>
            </h2>
          </div>

          <div
            style={{ opacity: t2Opacity, transform: `translateY(${t2Y}px)` }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6"
          >
            <h2 className="font-display text-4xl font-black leading-[0.95] text-white sm:text-6xl md:text-7xl">
              Every frame,
              <br />
              <span className="text-goldleaf">handled.</span>
            </h2>
          </div>

          <div
            style={{ opacity: t3Opacity, transform: `translateY(${t3Y}px)` }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6"
          >
            <span className="text-[10px] uppercase tracking-[0.35em] text-primary">
              Now booking · 2026
            </span>
            <h2 className="mt-4 font-display text-5xl font-black leading-[0.95] text-white sm:text-7xl md:text-8xl">
              Book the <span className="text-goldleaf">moment.</span>
            </h2>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-6 left-1/2 z-10 h-[2px] w-40 -translate-x-1/2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-goldleaf"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
