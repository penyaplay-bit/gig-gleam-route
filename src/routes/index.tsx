"use client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { lazy, Suspense, useRef } from "react";
import { ArrowRight, Users } from "lucide-react";
import { LogoMark, LogoLockup } from "@/components/brand/logo-mark";
import { GrainOverlay } from "@/components/brand/grain";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";
import { StageFloor } from "@/components/brand/stage-elements";
import { Reveal } from "@/components/motion/reveal";

const BelowFold = lazy(() =>
  import("@/components/landing/below-fold").then((m) => ({ default: m.BelowFold })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PenyaPlay — Book Ntate Stunna & the Penya Play roster" },
      {
        name: "description",
        content:
          "The cinematic booking OS for Ntate Stunna and Penya Play artists. Request, quote, deposit, confirm — every step guided.",
      },
      { property: "og:title", content: "PenyaPlay — Book the moment." },
      {
        property: "og:description",
        content: "Book Ntate Stunna & Penya Play artists. Serious bookings only.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GrainOverlay />
      <TopNav />
      <Hero />
      <Suspense fallback={<div className="h-40" />}>
        <BelowFold />
      </Suspense>
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/">
          <LogoLockup />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/find-gigs"
            className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline-block"
          >
            Find Gigs
          </Link>
          <Link
            to="/book"
            className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground shadow-quote transition hover:-translate-y-0.5 hover:bg-primary/90 sm:text-sm"
          >
            Book now
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/auth"
            className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline-block"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const logoScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.15, 0.55]);
  const logoY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -80]);
  const titleY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -40]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1, 0.15]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <motion.div style={{ opacity: glowOpacity }} className="absolute inset-0">
        <CinematicBackdrop variant="portal" />
      </motion.div>

      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <motion.div style={{ scale: logoScale, y: logoY }} className="mx-auto flex justify-center">
          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-primary/30 blur-3xl" aria-hidden />
            <LogoMark size={140} priority className="relative rounded-2xl ring-2 ring-primary/50 shadow-cinema" />
          </div>
        </motion.div>

        <motion.div style={{ y: titleY }} className="mt-10 flex flex-col items-center text-center">
          <Reveal delay={0.1}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Now booking · 2026 season
            </span>
          </Reveal>

          <h1 className="mt-6 font-display text-[13vw] font-black leading-[0.9] sm:text-8xl md:text-[7rem]">
            Book the
            <br />
            <span className="text-goldleaf">moment.</span>
          </h1>

          <Reveal delay={0.3} className="mt-8 max-w-xl text-base text-muted-foreground sm:text-lg">
            The official booking OS for <span className="text-foreground">Ntate Stunna</span> and the
            Penya Play roster. Quote, deposit, confirm — every step cinematic.
          </Reveal>

          <Reveal delay={0.4} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/book"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-quote transition hover:-translate-y-0.5 hover:shadow-cinema"
            >
              Start a booking
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/30 px-8 py-4 text-sm text-foreground backdrop-blur-sm transition hover:border-primary/60 hover:bg-primary/5"
            >
              See how it works
            </a>
          </Reveal>

          <Reveal delay={0.5} className="mt-12 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            No deposit · No date. Every booking is verified.
          </Reveal>
        </motion.div>
      </div>
      <StageFloor />
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-primary/10 bg-background/60">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <LogoLockup />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link to="/book" className="hover:text-foreground">Book</Link>
            <Link to="/auth" className="hover:text-foreground">Staff sign in</Link>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Maseru · Lesotho
            </span>
          </div>
        </div>
        <div className="mt-8 border-t border-primary/10 pt-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          © Penya Play Music · Booking OS · Made with cinema.
        </div>
      </div>
    </footer>
  );
}
