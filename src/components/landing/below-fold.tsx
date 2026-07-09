"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Shield, Zap, Calendar, Music, Radio, BadgeCheck } from "lucide-react";
import ntateStunnaPicture from "@/assets/ntate-stunna.picture.json";
import { Picture } from "@/components/brand/picture";
import { LightShafts } from "@/components/brand/stage-elements";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { NumberTicker } from "@/components/motion/number-ticker";
import { MarqueeStrip } from "@/components/motion/marquee-strip";
import { ScrollScrubVideo } from "@/components/landing/scroll-scrub-video";

export function BelowFold() {
  return (
    <>
      <ScrollScrubVideo />
      <TickerMarquee />
      <StoryPin />
      <StatsRow />
      <BentoFeatures />
      <RosterStrip />
      <HowItWorks />
      <BigCTA />
    </>
  );
}

function TickerMarquee() {
  const items = [
    "MASERU", "BLOEMFONTEIN", "JOHANNESBURG", "DURBAN", "CAPE TOWN",
    "GABORONE", "QWAQWA", "WELKOM", "KIMBERLEY", "MANZINI",
  ];
  return (
    <div className="border-y border-primary/10 bg-card/40">
      <MarqueeStrip
        items={items.map((c, i) => (
          <span key={i} className="font-display text-xl uppercase tracking-[0.2em] text-foreground/70">
            {c}
          </span>
        ))}
      />
    </div>
  );
}

function StoryPin() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const slides = [
    { kicker: "01 · Request", title: "Any Penya artist", body: "Pick the artist, package, date. Two minutes." },
    { kicker: "02 · Quote", title: "In your inbox", body: "Itemised. Fair. No mystery pricing, no back-and-forth." },
    { kicker: "03 · Deposit", title: "Lock the date", body: "Upload proof, verified live. Only then is the date yours." },
    { kicker: "04 · Perform", title: "We handle the rest", body: "Travel, logistics, comms. You just show up." },
  ];
  return (
    <section ref={ref} className="relative" style={{ height: reduce ? "auto" : `${slides.length * 55}vh` }}>
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
        <div className="relative mx-auto w-full max-w-5xl px-4">
          {slides.map((s, i) => {
            const start = i / slides.length;
            const end = (i + 1) / slides.length;
            const mid = (start + end) / 2;
            return (
              <SlideCard key={i} slide={s} scrollYProgress={scrollYProgress} start={start} mid={mid} end={end} reduce={!!reduce} index={i} total={slides.length} />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SlideCard({ slide, scrollYProgress, start, mid, end, reduce, index, total }: {
  slide: { kicker: string; title: string; body: string };
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number; mid: number; end: number; reduce: boolean; index: number; total: number;
}) {
  const opacity = useTransform(scrollYProgress, [start, mid, end - 0.02], reduce ? [1, 1, 1] : [0, 1, 0]);
  const y = useTransform(scrollYProgress, [start, mid, end], reduce ? [0, 0, 0] : [80, 0, -80]);
  const scale = useTransform(scrollYProgress, [start, mid, end], reduce ? [1, 1, 1] : [0.92, 1, 0.92]);
  return (
    <motion.div style={reduce ? undefined : { opacity, y, scale }} className={`${reduce ? "mb-24" : "absolute inset-x-0"} flex flex-col items-center text-center`}>
      <span className="text-[10px] uppercase tracking-[0.35em] text-primary">{slide.kicker}</span>
      <h2 className="mt-4 font-display text-[12vw] font-black leading-[0.95] sm:text-7xl md:text-8xl">{slide.title}</h2>
      <p className="mt-6 max-w-lg text-lg text-muted-foreground">{slide.body}</p>
      <div className="mt-8 flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-0.5 w-8 rounded-full transition-colors ${i === index ? "bg-primary" : "bg-primary/15"}`} />
        ))}
      </div>
    </motion.div>
  );
}

function StatsRow() {
  const stats = [
    { label: "Cities toured", to: 42 },
    { label: "Bookings closed", to: 187 },
    { label: "Avg. deposit turnaround", to: 6, suffix: "h" },
    { label: "Artists managed", to: 4 },
  ];
  return (
    <section className="border-y border-primary/10 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <StaggerGroup className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((s) => (
            <StaggerItem key={s.label} className="text-center sm:text-left">
              <div className="font-display text-5xl font-black text-goldleaf sm:text-6xl">
                <NumberTicker to={s.to} suffix={s.suffix ?? ""} />
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{s.label}</div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

function BentoFeatures() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-24">
      <LightShafts count={4} />
      <Reveal>
        <span className="text-[10px] uppercase tracking-[0.35em] text-primary">Why PenyaPlay</span>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-black leading-[1] sm:text-6xl">
          Built for real bookings. <span className="text-muted-foreground">Not vibes.</span>
        </h2>
      </Reveal>
      <StaggerGroup className="mt-12 grid gap-4 md:grid-cols-6 md:grid-rows-2">
        <BentoCard className="md:col-span-4 md:row-span-1" tint>
          <Shield className="mb-3 h-6 w-6 text-primary" />
          <h3 className="font-display text-2xl font-bold">Deposit-locked or it's not a date.</h3>
          <p className="mt-2 text-sm text-muted-foreground">Every booking waits on verified proof of payment. Zero phantom dates, zero double-books, zero drama on show day.</p>
        </BentoCard>
        <BentoCard className="md:col-span-2 md:row-span-2">
          <Sparkles className="mb-3 h-6 w-6 text-primary" />
          <h3 className="font-display text-2xl font-bold">Every quote is scored.</h3>
          <p className="mt-2 text-sm text-muted-foreground">Our booking engine scores each request out of 100 — budget, brand fit, travel, risk. Fair pricing, every time.</p>
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Booking score</div>
            <div className="mt-1 font-display text-5xl font-black text-goldleaf">
              <NumberTicker to={91} /><span className="text-muted-foreground">/100</span>
            </div>
          </div>
        </BentoCard>
        <BentoCard className="md:col-span-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="mt-2 font-display text-lg font-bold">24-hour quotes</h3>
          <p className="mt-1 text-sm text-muted-foreground">Not "we'll get back to you". A real quote, fast.</p>
        </BentoCard>
        <BentoCard className="md:col-span-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="mt-2 font-display text-lg font-bold">Live availability</h3>
          <p className="mt-1 text-sm text-muted-foreground">Real calendar. Real routes. Real conflict detection.</p>
        </BentoCard>
      </StaggerGroup>
    </section>
  );
}

function BentoCard({ children, className = "", tint = false }: { children: React.ReactNode; className?: string; tint?: boolean }) {
  return (
    <StaggerItem className={`relative rounded-3xl border p-6 sm:p-8 ${tint ? "border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-card/40" : "border-primary/10 bg-card/50"} ${className}`}>
      {children}
    </StaggerItem>
  );
}

function RosterStrip() {
  const artists = [
    { name: "Ntate Stunna", tag: "Famo · Icon", accent: true, verified: true, picture: ntateStunnaPicture },
    { name: "Nthabi Sings", tag: "Afro-Soul" },
    { name: "+ More coming", tag: "Roster expanding", faded: true },
  ];
  return (
    <section className="relative border-y border-primary/10 bg-card/30">
      <LightShafts count={3} />
      <div className="relative mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <span className="text-[10px] uppercase tracking-[0.35em] text-primary">The roster</span>
          <h2 className="mt-3 font-display text-4xl font-black sm:text-5xl">Book the whole Penya family.</h2>
        </Reveal>
        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-3">
          {artists.map((a) => (
            <StaggerItem key={a.name} className={`group relative overflow-hidden rounded-2xl border p-6 transition ${a.accent ? "border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-card" : a.faded ? "border-primary/10 bg-card/40 text-muted-foreground" : "border-primary/15 bg-card/50 hover:border-primary/30"}`}>
              {a.picture ? (
                <div className="relative h-48 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl">
                  <Picture
                    manifest={a.picture}
                    alt={a.name}
                    sizes="(min-width: 640px) 400px, 100vw"
                    className="block h-full w-full"
                    imgClassName="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  {a.verified && (
                    <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary backdrop-blur">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </div>
                  )}
                </div>
              ) : (
                <Music className={`h-6 w-6 ${a.accent ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <div className={`${a.picture ? "" : "mt-8"} flex items-center gap-1.5 font-display text-2xl font-bold`}>
                {a.name}
                {a.verified && !a.photo && <BadgeCheck className="h-5 w-5 text-primary" />}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{a.tag}</div>
              {a.accent && (
                <div className="mt-6 inline-flex items-center gap-2 text-xs text-primary">
                  <Radio className="h-3.5 w-3.5" /> On tour · book now
                </div>
              )}
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: 1, t: "Request", d: "Submit event details, package, and your offer. Two minutes." },
    { n: 2, t: "Quote", d: "Ops returns an itemised quote — performance, travel, logistics." },
    { n: 3, t: "Deposit", d: "Pay 50% via bank transfer + upload proof. Date locks on verification." },
    { n: 4, t: "Perform", d: "We handle travel and setup. Balance settles before the show." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-24">
      <Reveal>
        <span className="text-[10px] uppercase tracking-[0.35em] text-primary">Playbook</span>
        <h2 className="mt-3 font-display text-4xl font-black sm:text-5xl">Four steps. Zero chasing.</h2>
      </Reveal>
      <StaggerGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <StaggerItem key={s.n} className="group relative rounded-2xl border border-primary/15 bg-card/50 p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-quote">
            <div className="font-display text-6xl font-black text-goldleaf">{String(s.n).padStart(2, "0")}</div>
            <h3 className="mt-4 font-display text-xl font-bold">{s.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

function BigCTA() {
  return (
    <section className="relative overflow-hidden border-y border-primary/10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.05] to-transparent" />
      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-5xl font-black leading-[1] sm:text-7xl">Ready when you are.</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">Serious bookings only. Start a request in two minutes.</p>
          <Link to="/book" className="group mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-10 py-5 text-sm font-semibold uppercase tracking-wider text-primary-foreground shadow-quote transition hover:-translate-y-0.5 hover:shadow-cinema">
            Start a booking <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
