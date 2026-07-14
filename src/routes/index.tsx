"use client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { lazy, Suspense } from "react";
import { ArrowRight, Users } from "lucide-react";
import { LogoLockup } from "@/components/brand/logo-mark";
import { GrainOverlay } from "@/components/brand/grain";
import logoAsset from "@/assets/penya-play-logo.jpg.asset.json";
import { FriendlyFunnel } from "@/components/landing/friendly-funnel";
import { CinematicVideoHero } from "@/components/landing/cinematic-video-hero";

const BelowFold = lazy(() =>
  import("@/components/landing/below-fold").then((m) => ({ default: m.BelowFold })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PenyaPlay — Africa's Live Entertainment Operating System" },
      {
        name: "description",
        content:
          "Discover performers, book venues, find events and build your booking reputation. The cinematic booking OS for Africa's live entertainment industry.",
      },
      { property: "og:title", content: "PenyaPlay — Africa's Live Entertainment OS" },
      {
        property: "og:description",
        content: "Discover performers. Book venues. Find events. Build your booking reputation.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: logoAsset.url },
      { name: "twitter:image", content: logoAsset.url },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GrainOverlay />
      <TopNav />
      <CinematicVideoHero />
      <FriendlyFunnel />
      <Suspense fallback={<div className="h-40" />}>
        <BelowFold />
      </Suspense>
      <Footer />
    </div>
  );
}

function TopNav() {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 120], ["rgba(0,0,0,0)", "rgba(10,10,10,0.72)"]);
  const border = useTransform(scrollY, [0, 120], ["rgba(232,184,90,0)", "rgba(232,184,90,0.25)"]);
  const blur = useTransform(scrollY, [0, 120], ["blur(0px)", "blur(18px)"]);

  return (
    <motion.header
      style={{ backgroundColor: bg, borderBottomColor: border, backdropFilter: blur, WebkitBackdropFilter: blur }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-40 border-b"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/">
          <LogoLockup />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/find-gigs"
            className="text-xs text-white/70 hover:text-white"
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
            className="hidden text-xs text-white/70 hover:text-white sm:inline-block"
          >
            Sign in
          </Link>
        </div>
      </div>
    </motion.header>
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
