"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion, useSpring } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import heroVideo from "@/assets/penya-hero.mp4.asset.json";

const SUGGESTIONS = [
  "DJ",
  "Singer",
  "Comedian",
  "Venue",
  "Photographer",
  "Wedding MC",
  "Spider-Man Performer",
  "Conference Speaker",
  "Dance Crew",
  "Choir",
];

/**
 * Cinematic scroll-driven video hero. The video acts as the atmosphere;
 * UI floats above with subtle parallax and gold ambience.
 */
export function CinematicVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  // Section is 180vh tall so we get scroll room. Sticky inner fills the viewport.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const smooth = useSpring(scrollYProgress, { stiffness: 60, damping: 22, mass: 0.6 });

  // Layered parallax — video slowest, overlays a bit faster, UI barely moves.
  const videoScale = useTransform(smooth, [0, 1], reduce ? [1, 1] : [1.06, 1.18]);
  const videoY = useTransform(smooth, [0, 1], reduce ? ["0%", "0%"] : ["0%", "6%"]);
  const overlayY = useTransform(smooth, [0, 1], reduce ? ["0%", "0%"] : ["0%", "12%"]);
  const particlesY = useTransform(smooth, [0, 1], reduce ? ["0%", "0%"] : ["0%", "-18%"]);
  const uiY = useTransform(smooth, [0, 1], reduce ? ["0%", "0%"] : ["0%", "-4%"]);
  const uiOpacity = useTransform(smooth, [0, 0.55, 0.9], [1, 0.85, 0]);
  const glowOpacity = useTransform(smooth, [0, 1], [0.9, 0.35]);

  // Scroll-linked playback — feels like floating through the frame instead of scrubbing.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduce) return;
    let raf = 0;
    let target = 0;
    let current = 0;
    const tick = () => {
      current += (target - current) * 0.08;
      if (v.duration && Number.isFinite(v.duration)) {
        // Blend scroll position with natural playback so it never feels frozen.
        const dur = v.duration;
        const t = Math.max(0, Math.min(dur - 0.05, current * dur));
        if (Math.abs(v.currentTime - t) > 0.05) {
          try { v.currentTime = t; } catch { /* seeking guard */ }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const unsub = smooth.on("change", (val) => { target = val; });
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); unsub(); };
  }, [smooth, reduce]);

  // Ensure autoplay kicks in on mobile Safari.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const play = () => v.play().catch(() => {});
    play();
    document.addEventListener("touchstart", play, { once: true });
    return () => document.removeEventListener("touchstart", play);
  }, []);

  // Mouse parallax — max 5px per spec.
  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      setMouse({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduce]);

  return (
    <section ref={sectionRef} className="relative h-[180vh] bg-black">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Layer 1 — video atmosphere */}
        <motion.div
          style={{ scale: videoScale, y: videoY, x: mouse.x * 0.3, translateY: mouse.y * 0.3 }}
          className="absolute inset-0 will-change-transform"
        >
          <video
            ref={videoRef}
            src={heroVideo.url}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster=""
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* Layer 2 — cinematic overlays */}
        <motion.div style={{ y: overlayY }} className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/85" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.85)_90%)]" />
        </motion.div>

        {/* Layer 3 — floating gold particles */}
        <motion.div
          style={{ y: particlesY, opacity: glowOpacity }}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          {Array.from({ length: 24 }).map((_, i) => {
            const size = 1 + (i % 4);
            const left = (i * 37) % 100;
            const top = (i * 53) % 100;
            const delay = (i % 8) * 0.7;
            return (
              <span
                key={i}
                className="absolute rounded-full bg-primary"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${left}%`,
                  top: `${top}%`,
                  filter: "blur(0.5px)",
                  boxShadow: "0 0 12px 2px rgba(232,184,90,0.6)",
                  opacity: 0.35 + (i % 5) * 0.1,
                  animation: `particle-float ${8 + (i % 6)}s ease-in-out ${delay}s infinite`,
                }}
              />
            );
          })}
        </motion.div>

        {/* Layer 5 — light rays / bloom */}
        <motion.div
          style={{ opacity: glowOpacity }}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          <div className="absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,184,90,0.18),transparent_60%)] blur-2xl" />
          <div className="absolute -top-40 left-1/4 h-[60vh] w-1 rotate-12 bg-gradient-to-b from-primary/40 to-transparent blur-2xl" />
          <div className="absolute -top-40 right-1/4 h-[60vh] w-1 -rotate-12 bg-gradient-to-b from-primary/30 to-transparent blur-2xl" />
        </motion.div>

        {/* Layer 4 — UI, floats subtly */}
        <motion.div
          style={{ y: uiY, opacity: uiOpacity, x: mouse.x * -0.5 }}
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
            Discover performers. Book venues. Find events.
            <br className="hidden sm:block" />
            Build your booking reputation.
          </p>

          {/* Search */}
          <div className="mt-8 w-full max-w-2xl">
            <div className="group flex items-center gap-2 rounded-full border border-primary/25 bg-black/40 px-4 py-2 backdrop-blur-xl transition focus-within:border-primary/70 focus-within:shadow-quote">
              <Search className="h-4 w-4 shrink-0 text-primary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Who are you looking for today?"
                aria-label="Search performers, venues and events"
                className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/50 focus:outline-none sm:text-base"
              />
              <Link
                to="/find-gigs"
                className="hidden shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition hover:bg-primary/90 sm:inline-block"
              >
                Search
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70 backdrop-blur transition hover:border-primary/50 hover:bg-primary/10 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
            Indicative previews · Every booking sharp sharp verified
          </div>
        </motion.div>

        {/* Bottom fade for seamless section blend */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}
