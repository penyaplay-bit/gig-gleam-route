"use client";
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    video.pause();

    let raf = 0;
    let active = false;
    let targetTime = 0;
    let currentTime = 0;

    const compute = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when section top hits viewport top; 1 when section bottom hits viewport bottom
      const total = rect.height - vh;
      const scrolled = -rect.top;
      const p = clamp01(total > 0 ? scrolled / total : 0);
      setProgress(p);
      const dur = video.duration;
      if (isFinite(dur) && dur > 0) {
        targetTime = p * dur;
      }
    };

    const tick = () => {
      // ease toward target for buttery scrub
      currentTime = lerp(currentTime, targetTime, 0.18);
      if (Math.abs(currentTime - targetTime) < 0.005) currentTime = targetTime;
      if (isFinite(currentTime) && video.readyState >= 2) {
        try {
          video.currentTime = currentTime;
        } catch {}
      }
      if (active) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => compute();
    const onResize = () => compute();
    const onLoaded = () => {
      setReady(true);
      compute();
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (!active) {
              active = true;
              compute();
              currentTime = targetTime;
              raf = requestAnimationFrame(tick);
            }
          } else {
            active = false;
            cancelAnimationFrame(raf);
          }
        }
      },
      { rootMargin: "0px", threshold: 0 }
    );

    io.observe(section);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("canplay", onLoaded);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    compute();

    return () => {
      io.disconnect();
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Text beats keyed to progress
  const t1Opacity = mapClamp(progress, 0.0, 0.15, 1, 0) * mapClamp(progress, 0.0, 0.05, 0, 1);
  const t2Opacity = mapClamp(progress, 0.3, 0.45, 0, 1) * mapClamp(progress, 0.55, 0.7, 1, 0);
  const t3Opacity = mapClamp(progress, 0.78, 0.9, 0, 1);
  const t1Y = mapClamp(progress, 0, 0.2, 0, -30);
  const t2Y = mapClamp(progress, 0.3, 0.7, 20, -20);
  const t3Y = mapClamp(progress, 0.78, 1, 30, 0);

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: "320vh" }}
      aria-label="Scroll to scrub"
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoAsset.url}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />

        {/* vignette + gradient wash */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,black_100%)] opacity-70" />

        {/* Text beats */}
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <div
            style={{ opacity: t1Opacity, transform: `translateY(${t1Y}px)` }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          >
            <span className="text-[10px] uppercase tracking-[0.35em] text-primary">
              Scroll to enter
            </span>
            <h2 className="mt-4 font-display text-[13vw] font-black leading-[0.9] text-white sm:text-8xl">
              The moment,
              <br />
              <span className="text-goldleaf">unfolded.</span>
            </h2>
          </div>

          <div
            style={{ opacity: t2Opacity, transform: `translateY(${t2Y}px)` }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          >
            <h2 className="font-display text-[10vw] font-black leading-[0.95] text-white sm:text-7xl">
              Every frame,
              <br />
              <span className="text-goldleaf">handled.</span>
            </h2>
          </div>

          <div
            style={{ opacity: t3Opacity, transform: `translateY(${t3Y}px)` }}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          >
            <span className="text-[10px] uppercase tracking-[0.35em] text-primary">
              Now booking · 2026
            </span>
            <h2 className="mt-4 font-display text-[12vw] font-black leading-[0.9] text-white sm:text-8xl">
              Book the <span className="text-goldleaf">moment.</span>
            </h2>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-6 left-1/2 z-10 h-[2px] w-40 -translate-x-1/2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-goldleaf transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {!ready && (
          <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/60">
            Loading film…
          </div>
        )}
      </div>
    </section>
  );
}
