"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import videoAsset from "@/assets/penya-live-reveal.mp4.asset.json";

export function ScrollScrubVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [1, 1.08, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], reduce ? ["0px", "0px"] : ["40px", "-40px"]);

  return (
    <section ref={sectionRef} className="relative h-[300vh] bg-black">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.video
          src={videoAsset.url}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          style={{ scale, opacity }}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* wash + vignette */}
        <div className="pointer-events-none absolute inset-0 bg-black/45" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]" />

        <motion.div
          style={{ y: textY, opacity }}
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
