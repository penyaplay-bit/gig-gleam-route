"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion, useSpring } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import heroVideo from "@/assets/penya-hero.mp4.asset.json";

/**
 * Scroll-controlled cinematic hero. Video is paused and its currentTime is
 * driven by scroll progress, interpolated per-frame for buttery scrubbing.
 * Falls back to autoplay loop if the device can't keep up.
 */
export function CinematicVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [fallback, setFallback] = useState(false);
  const [duration, setDuration] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Heavy, luxurious easing — feels like inertia, not a jitter.
  const smooth = useSpring(scrollYProgress, { stiffness: 45, damping: 20, mass: 0.9 });

  const uiY = useTransform(smooth, [0, 0.6], reduce ? ["0%", "0%"] : ["0%", "-15%"]);
  const uiOpacity = useTransform(smooth, [0, 0.45, 0.8], [1, 0.7, 0]);
  const ringProgress = useTransform(smooth, [0, 1], [0, 1]);
  const ringDash = useTransform(ringProgress, (p) => `${p * 138} 138`);

  // Prime video: load first frame, keep paused.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    const onMeta = () => {
      setDuration(v.duration || 0);
      try { v.currentTime = 0.001; } catch { /* noop */ }
    };
    if (v.readyState >= 1) onMeta();
    else v.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, []);

  // Scroll-driven currentTime with rAF interpolation.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduce || fallback || !duration) return;
    v.pause();
    let raf = 0;
    let target = 0;
    let current = 0;
    let stallCount = 0;
    let lastSetAt = 0;

    const tick = () => {
      const delta = target - current;
      current += delta * 0.12; // heavy easing
      const t = Math.max(0, Math.min(duration - 0.05, current * duration));
      if (Math.abs(v.currentTime - t) > 0.02) {
        try {
          v.currentTime = t;
          // Detect scrubbing stall: if the browser can't seek fast enough.
          const now = performance.now();
          if (now - lastSetAt < 40 && v.readyState < 2) {
            stallCount++;
            if (stallCount > 30) setFallback(true);
          } else {
            stallCount = Math.max(0, stallCount - 1);
          }
          lastSetAt = now;
        } catch { /* seeking guard */ }
      }
      raf = requestAnimationFrame(tick);
    };
    const unsub = smooth.on("change", (val) => { target = Math.max(0, Math.min(1, val)); });
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); unsub(); };
  }, [smooth, reduce, fallback, duration]);

  // Fallback mode — autoplay loop with subtle parallax.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (fallback || reduce) {
      v.loop = true;
      v.muted = true;
      v.play().catch(() => {});
    }
  }, [fallback, reduce]);

  return (
    <section ref={sectionRef} className="relative h-[260vh] bg-black">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Video layer */}
        <video
          ref={videoRef}
          src={heroVideo.url}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Cinematic overlays */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_95%)]" />
        </div>

        {/* Gold volumetric light */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,184,90,0.16),transparent_60%)] blur-2xl" />
          <div className="absolute -top-40 left-1/4 h-[60vh] w-1 rotate-12 bg-gradient-to-b from-primary/40 to-transparent blur-2xl" />
          <div className="absolute -top-40 right-1/4 h-[60vh] w-1 -rotate-12 bg-gradient-to-b from-primary/30 to-transparent blur-2xl" />
        </div>

        {/* Floating dust particles */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {Array.from({ length: 22 }).map((_, i) => {
            const size = 1 + (i % 3);
            const left = (i * 37) % 100;
            const top = (i * 53) % 100;
            const delay = (i % 8) * 0.6;
            return (
              <span
                key={i}
                className="absolute rounded-full bg-primary/70"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${left}%`,
                  top: `${top}%`,
                  boxShadow: "0 0 10px 2px rgba(232,184,90,0.55)",
                  opacity: 0.3 + (i % 5) * 0.1,
                  animation: `particle-float ${9 + (i % 6)}s ease-in-out ${delay}s infinite`,
                }}
              />
            );
          })}
        </div>

        {/* Hero UI */}
        <motion.div
          style={{ y: uiY, opacity: uiOpacity }}
          className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary backdrop-blur-md">
            <Sparkles className="h-3 w-3" />
            Africa · Live · Booking OS
          </span>

          <h1 className="mt-6 max-w-5xl font-display text-[10vw] font-black leading-[0.92] text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            Africa&rsquo;s Live Entertainment
            <br />
            <span className="text-goldleaf">Operating System</span>
          </h1>

          <p className="mt-6 max-w-2xl text-sm text-white/75 sm:text-base md:text-lg">
            Book talent. Discover venues. Build your reputation.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/book"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-quote transition hover:-translate-y-0.5 hover:shadow-cinema"
            >
              Start Booking
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/find-gigs"
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/40 px-7 py-3.5 text-sm text-white backdrop-blur-md transition hover:border-primary/70 hover:bg-primary/10"
            >
              Explore Talent
            </Link>
          </div>

          <div className="mt-10 text-[10px] uppercase tracking-[0.3em] text-white/50">
            Scroll to descend · Every booking sharp sharp verified
          </div>
        </motion.div>

        {/* Circular progress ring */}
        <div className="pointer-events-none absolute bottom-6 right-6 z-20">
          <svg width="56" height="56" viewBox="0 0 50 50" className="drop-shadow-[0_0_12px_rgba(232,184,90,0.5)]">
            <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
            <motion.circle
              cx="25"
              cy="25"
              r="22"
              fill="none"
              stroke="rgb(232,184,90)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={ringDash}
              transform="rotate(-90 25 25)"
            />
          </svg>
        </div>

        {/* Bottom seam */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}
