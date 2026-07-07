"use client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { ArrowRight, Sparkles, Shield, Zap, Calendar, Music, Radio, Users } from "lucide-react";
import { LogoMark, LogoLockup } from "@/components/brand/logo-mark";
import { GrainOverlay } from "@/components/brand/grain";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { NumberTicker } from "@/components/motion/number-ticker";
import { MarqueeStrip } from "@/components/motion/marquee-strip";

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
      <TickerMarquee />
      <StoryPin />
      <StatsRow />
      <BentoFeatures />
      <RosterStrip />
      <HowItWorks />
      <BigCTA />
      <Footer />
    </div>
  );
}

/* ---------- Top nav ---------- */
function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/">
          <LogoLockup />
        </Link>
        <div className="flex items-center gap-2">
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
            Staff
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero with parallax logo ---------- */
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
      {/* Radial gold spotlight */}
      <motion.div
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute left-1/2 top-0 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-70 blur-3xl"
      >
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.82 0.16 88 / 0.35), transparent 60%)",
          }}
        />
      </motion.div>

      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-24 sm:pt-24 sm:pb-32">
        {/* Floating logo */}
        <motion.div
          style={{ scale: logoScale, y: logoY }}
          className="mx-auto flex justify-center"
        >
          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-primary/30 blur-3xl" aria-hidden />
            <LogoMark size={140} className="relative rounded-2xl ring-2 ring-primary/50 shadow-cinema" />
          </div>
        </motion.div>

        {/* Kicker */}
        <motion.div
          style={{ y: titleY }}
          className="mt-10 flex flex-col items-center text-center"
        >
          <Reveal delay={0.1}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Now booking · 2026 season
            </span>
          </Reveal>

          {/* Title with word-by-word stagger */}
          <h1 className="mt-6 font-display text-[13vw] font-black leading-[0.9] sm:text-8xl md:text-[7rem]">
            <WordSplit text="Book the" delay={0.15} />
            <br />
            <span className="text-goldleaf">
              <WordSplit text="moment." delay={0.35} />
            </span>
          </h1>

          <Reveal delay={0.6} className="mt-8 max-w-xl text-base text-muted-foreground sm:text-lg">
            The official booking OS for <span className="text-foreground">Ntate Stunna</span> and the
            Penya Play roster. Quote, deposit, confirm — every step cinematic.
          </Reveal>

          <Reveal delay={0.75} className="mt-10 flex flex-wrap items-center justify-center gap-3">
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

          <Reveal delay={0.9} className="mt-12 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            No deposit · No date. Every booking is verified.
          </Reveal>
        </motion.div>
      </div>
    </section>
  );
}

function WordSplit({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className="inline-block">
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pr-[0.15em] align-bottom">
          <motion.span
            initial={reduce ? undefined : { y: "110%", opacity: 0 }}
            animate={reduce ? undefined : { y: "0%", opacity: 1 }}
            transition={{ duration: 0.9, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
          >
            {w}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ---------- Marquee ---------- */
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

/* ---------- Sticky story pin ---------- */
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
    <section
      ref={ref}
      className="relative"
      style={{ height: reduce ? "auto" : `${slides.length * 100}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />

        <div className="relative mx-auto w-full max-w-5xl px-4">
          {slides.map((s, i) => {
            const start = i / slides.length;
            const end = (i + 1) / slides.length;
            const mid = (start + end) / 2;
            return (
              <SlideCard
                key={i}
                slide={s}
                scrollYProgress={scrollYProgress}
                start={start}
                mid={mid}
                end={end}
                reduce={!!reduce}
                index={i}
                total={slides.length}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SlideCard({
  slide,
  scrollYProgress,
  start,
  mid,
  end,
  reduce,
  index,
  total,
}: {
  slide: { kicker: string; title: string; body: string };
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  mid: number;
  end: number;
  reduce: boolean;
  index: number;
  total: number;
}) {
  const opacity = useTransform(
    scrollYProgress,
    [start, mid, end - 0.02],
    reduce ? [1, 1, 1] : [0, 1, 0],
  );
  const y = useTransform(
    scrollYProgress,
    [start, mid, end],
    reduce ? [0, 0, 0] : [80, 0, -80],
  );
  const scale = useTransform(scrollYProgress, [start, mid, end], reduce ? [1, 1, 1] : [0.92, 1, 0.92]);

  return (
    <motion.div
      style={reduce ? undefined : { opacity, y, scale }}
      className={`${reduce ? "mb-24" : "absolute inset-x-0"} flex flex-col items-center text-center`}
    >
      <span className="text-[10px] uppercase tracking-[0.35em] text-primary">
        {slide.kicker}
      </span>
      <h2 className="mt-4 font-display text-[12vw] font-black leading-[0.95] sm:text-7xl md:text-8xl">
        {slide.title}
      </h2>
      <p className="mt-6 max-w-lg text-lg text-muted-foreground">{slide.body}</p>
      <div className="mt-8 flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-0.5 w-8 rounded-full transition-colors ${
              i === index ? "bg-primary" : "bg-primary/15"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- Stats ---------- */
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
              <div className="mt-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {s.label}
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

/* ---------- Bento features ---------- */
function BentoFeatures() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
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
          <p className="mt-2 text-sm text-muted-foreground">
            Every booking waits on verified proof of payment. Zero phantom dates, zero double-books,
            zero drama on show day.
          </p>
        </BentoCard>

        <BentoCard className="md:col-span-2 md:row-span-2">
          <Sparkles className="mb-3 h-6 w-6 text-primary" />
          <h3 className="font-display text-2xl font-bold">Every quote is scored.</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Our booking engine scores each request out of 100 — budget, brand fit, travel,
            risk. Fair pricing, every time.
          </p>
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Booking score</div>
            <div className="mt-1 font-display text-5xl font-black text-goldleaf">
              <NumberTicker to={91} />
              <span className="text-muted-foreground">/100</span>
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

function BentoCard({
  children,
  className = "",
  tint = false,
}: {
  children: React.ReactNode;
  className?: string;
  tint?: boolean;
}) {
  return (
    <StaggerItem
      className={`relative rounded-3xl border p-6 sm:p-8 ${
        tint
          ? "border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-card/40"
          : "border-primary/10 bg-card/50"
      } ${className}`}
    >
      {children}
    </StaggerItem>
  );
}

/* ---------- Roster ---------- */
function RosterStrip() {
  const artists = [
    { name: "Ntate Stunna", tag: "Famo · Icon", accent: true },
    { name: "Nthabi Sings", tag: "Afro-Soul" },
    { name: "+ More coming", tag: "Roster expanding", faded: true },
  ];
  return (
    <section className="border-y border-primary/10 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <span className="text-[10px] uppercase tracking-[0.35em] text-primary">The roster</span>
          <h2 className="mt-3 font-display text-4xl font-black sm:text-5xl">Book the whole Penya family.</h2>
        </Reveal>
        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-3">
          {artists.map((a) => (
            <StaggerItem
              key={a.name}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition ${
                a.accent
                  ? "border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-card"
                  : a.faded
                  ? "border-primary/10 bg-card/40 text-muted-foreground"
                  : "border-primary/15 bg-card/50 hover:border-primary/30"
              }`}
            >
              <Music className={`h-6 w-6 ${a.accent ? "text-primary" : "text-muted-foreground"}`} />
              <div className="mt-8 font-display text-2xl font-bold">{a.name}</div>
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

/* ---------- How it works ---------- */
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
          <StaggerItem
            key={s.n}
            className="group relative rounded-2xl border border-primary/15 bg-card/50 p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-quote"
          >
            <div className="font-display text-6xl font-black text-goldleaf">
              {String(s.n).padStart(2, "0")}
            </div>
            <h3 className="mt-4 font-display text-xl font-bold">{s.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}

/* ---------- Big CTA ---------- */
function BigCTA() {
  return (
    <section className="relative overflow-hidden border-y border-primary/10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.05] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <div className="relative mx-auto max-w-4xl px-4 py-32 text-center">
        <Reveal>
          <span className="text-[10px] uppercase tracking-[0.35em] text-primary">Ready?</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-6 font-display text-[14vw] font-black leading-[0.9] sm:text-8xl md:text-[9rem]">
            Let's <span className="text-goldleaf">book it.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-md text-muted-foreground">
            Two minutes to submit. Written quote within 24 hours.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <Link
            to="/book"
            className="group mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-10 py-5 text-sm font-semibold uppercase tracking-widest text-primary-foreground shadow-cinema transition hover:-translate-y-1 hover:glow-gold"
          >
            Start booking now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
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
