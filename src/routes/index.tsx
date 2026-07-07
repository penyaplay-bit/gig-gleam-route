import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Shield, Zap, Calendar, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Penya Play Bookings — Book Ntate Stunna & Penya Play artists" },
      {
        name: "description",
        content:
          "The official booking portal for Ntate Stunna and Penya Play artists. Request a quote, secure your date with a deposit, and confirm your event.",
      },
      { property: "og:title", content: "Penya Play Bookings" },
      { property: "og:description", content: "Book Ntate Stunna & Penya Play artists. Serious bookings only." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-primary/10 bg-background/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-primary text-xl">◆</span>
            <span className="font-display tracking-wider">PENYA PLAY</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/book"
              className="hidden sm:inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Book an artist <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
              Staff
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-24 sm:py-32">
          <div className="max-w-3xl">
            <span className="inline-block text-xs uppercase tracking-widest text-primary/80 mb-4">
              Official booking portal
            </span>
            <h1 className="text-5xl sm:text-7xl font-display leading-tight">
              Book <span className="text-primary">Ntate Stunna</span> &<br />
              Penya Play artists.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Every booking is qualified, priced, and protected. From private events to festivals — request a quote, secure the
              date with a deposit, and we handle the rest.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/book"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 shadow-quote"
              >
                Request a booking <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-md border border-primary/30 px-6 py-3 text-sm text-foreground hover:bg-primary/5"
              >
                How it works
              </a>
            </div>
            <p className="mt-8 text-xs text-muted-foreground italic">
              Serious bookings only. Dates are not confirmed until the deposit is verified.
            </p>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-primary/10 bg-card/30">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-display mb-2">How a booking works</h2>
          <p className="text-muted-foreground mb-12">Transparent, protected, no chasing.</p>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, t: "Request", d: "Submit event details, package, and your offer. Takes 2 minutes." },
              { n: 2, t: "Quote", d: "Our ops team returns an itemised quote — performance fee, travel, logistics." },
              { n: 3, t: "Deposit", d: "Pay the deposit (usually 50%) via bank transfer and upload proof. Date locked on verification." },
              { n: 4, t: "Perform", d: "We handle travel and setup. Balance settles before the show. You get the memory." },
            ].map((s) => (
              <li key={s.n} className="rounded-xl border border-primary/15 bg-background/60 p-6">
                <span className="text-3xl font-display text-primary">{String(s.n).padStart(2, "0")}</span>
                <h3 className="mt-3 font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Trust / features */}
      <section className="border-t border-primary/10">
        <div className="max-w-6xl mx-auto px-4 py-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: Shield, t: "Deposit-locked", d: "No dates confirmed on promises. Only verified payments." },
            { Icon: Zap, t: "Fast quotes", d: "Priced by our engine, reviewed by ops, returned within 24 hours." },
            { Icon: Calendar, t: "Real availability", d: "Live calendar means you never chase a phantom date." },
            { Icon: LineChart, t: "Full transparency", d: "Every fee is itemised — performance, travel, per-diem, accommodation." },
          ].map(({ Icon, t, d }) => (
            <div key={t}>
              <Icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-primary/10 bg-gradient-to-b from-transparent to-primary/5">
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h2 className="text-4xl font-display">Ready to book?</h2>
          <p className="mt-4 text-muted-foreground">
            Complete the request form — we'll come back with a written quote and next steps.
          </p>
          <Link
            to="/book"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-8 py-4 text-base font-medium text-primary-foreground hover:bg-primary/90 shadow-quote"
          >
            Request a booking <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-primary/10 py-8 text-center text-xs text-muted-foreground">
        © Penya Play Music · Maseru · Booking OS
      </footer>
    </div>
  );
}
