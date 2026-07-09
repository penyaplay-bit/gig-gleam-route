"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import videoAsset from "@/assets/penya-live-reveal.mp4.asset.json";

export function ScrollScrubVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [nearby, setNearby] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [1, 1.06, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], reduce ? ["0px", "0px"] : ["30px", "-30px"]);

  // Only mount the <video> once the section is close to viewport.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNearby(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setNearby(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[180vh] bg-black">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {nearby && (
          <motion.video
            src={videoAsset.url}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            disablePictureInPicture
            style={{ scale, opacity }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

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
