"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import stage01 from "@/assets/penya-stage-01.jpg.asset.json";
import stage02 from "@/assets/penya-stage-02.jpg.asset.json";
import stage03 from "@/assets/penya-stage-03.jpg.asset.json";

const FRAMES = [stage01.url, stage02.url, stage03.url];

/**
 * Scroll-scrub cinematic hero. Replaces the heavy autoplay video with three
 * cross-fading, lightly-parallaxed stage stills served from the CDN.
 * ~90% smaller payload, no video decode, instant paint.
 */
export function ScrollScrubVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [1.05, 1.12, 1.05]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], reduce ? ["0px", "0px"] : ["30px", "-30px"]);

  // Cross-fade three frames across scroll progress.
  const op0 = useTransform(scrollYProgress, [0.0, 0.15, 0.38, 0.48], [1, 1, 1, 0]);
  const op1 = useTransform(scrollYProgress, [0.38, 0.48, 0.68, 0.78], [0, 1, 1, 0]);
  const op2 = useTransform(scrollYProgress, [0.68, 0.78, 1.0, 1.0], [0, 1, 1, 1]);
  const opacities = [op0, op1, op2];

  return (
    <section ref={sectionRef} className="relative h-[220vh] bg-black">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {FRAMES.map((src, i) => (
          <motion.img
            key={src}
            src={src}
            alt=""
            aria-hidden
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "low"}
            style={{ scale, opacity: opacities[i] }}
            className="absolute inset-0 h-full w-full object-cover will-change-[transform,opacity]"
          />
        ))}

        <div className="pointer-events-none absolute inset-0 bg-black/40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.9)_100%)]" />

        <motion.div
          style={{ y: textY, opacity: textOpacity }}
          className="relative z-10 px-6 text-center"
        >
          <span className="text-[10px] uppercase tracking-[0.35em] text-primary">
            Now booking · 2026
          </span>
          <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-white sm:text-6xl md:text-7xl">
            PENYA <span className="text-goldleaf">LIVE</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80 md:text-2xl">
            One event. One operating brain. Total control.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
