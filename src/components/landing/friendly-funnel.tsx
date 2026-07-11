// "What are you planning?" — friendly funnel top for Thato.
// Non-technical language. Every option deep-links into /book with prefilled event_type
// so the existing booking flow stays intact.
import { Link } from "@tanstack/react-router";
import { Cake, PartyPopper, Briefcase, School, Music2, Users2, Sparkles, Heart } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

const OPTIONS = [
  { key: "birthday", label: "Birthday party", Icon: Cake },
  { key: "wedding", label: "Wedding", Icon: Heart },
  { key: "corporate", label: "Corporate event", Icon: Briefcase },
  { key: "school", label: "School event", Icon: School },
  { key: "club", label: "Club night", Icon: Music2 },
  { key: "family", label: "Family celebration", Icon: Users2 },
  { key: "festival", label: "Festival", Icon: PartyPopper },
  { key: "other", label: "Something else", Icon: Sparkles },
] as const;

export function FriendlyFunnel() {
  return (
    <section className="relative border-t border-primary/10 bg-background/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <Reveal>
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              Start here
            </span>
            <h2 className="mt-4 font-display text-3xl font-black leading-tight sm:text-5xl">
              What are you planning?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Pick the vibe. We&rsquo;ll match you with verified performers in seconds — no signup needed to browse.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {OPTIONS.map(({ key, label, Icon }) => (
              <Link
                key={key}
                to="/book"
                search={{ event_type: key } as never}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-primary/15 bg-background/60 p-5 text-center backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/20">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.2} className="mt-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Browse freely · Verify only when it matters · Payment protected
          </p>
        </Reveal>
      </div>
    </section>
  );
}
