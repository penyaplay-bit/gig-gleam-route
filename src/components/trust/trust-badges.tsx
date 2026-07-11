// Reusable trust badges for performer & buyer cards.
// Progressive-trust model — badges are DERIVED, never hand-managed.
// Tap a badge to see a plain-language explainer.
import { ShieldCheck, Baby, Building2, CreditCard, Star, History } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TrustBadgeKind =
  | "identity"
  | "family_event"
  | "business"
  | "payment_protected"
  | "highly_rated"
  | "booking_history";

const CONFIG: Record<TrustBadgeKind, { label: string; explain: string; Icon: typeof ShieldCheck; tone: string }> = {
  identity: {
    label: "Identity Verified",
    explain: "We&rsquo;ve confirmed this performer is who they say they are. Real name, real person, sharp sharp.",
    Icon: ShieldCheck,
    tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  },
  family_event: {
    label: "Family Event Ready",
    explain: "Extra checks and references done. Safe hands for kids&rsquo; parties, family jols, and school events.",
    Icon: Baby,
    tone: "text-pink-200 border-pink-400/40 bg-pink-500/10",
  },
  business: {
    label: "Business Verified",
    explain: "Registered company, real owner, real address. Perfect for corporate gigs and big-ticket events.",
    Icon: Building2,
    tone: "text-blue-200 border-blue-400/40 bg-blue-500/10",
  },
  payment_protected: {
    label: "Payment Protected",
    explain: "Pay through Penya Play and your deposit is safe. No stories, no eish moments — we&rsquo;ve got you.",
    Icon: CreditCard,
    tone: "text-primary border-primary/40 bg-primary/10",
  },
  highly_rated: {
    label: "Crowd Favourite",
    explain: "Consistently kwaai reviews from real clients. This one brings the gees every time.",
    Icon: Star,
    tone: "text-yellow-200 border-yellow-400/40 bg-yellow-500/10",
  },
  booking_history: {
    label: "Proven on Stage",
    explain: "Solid track record of completed gigs on Penya Play. Not their first rodeo.",
    Icon: History,
    tone: "text-violet-200 border-violet-400/40 bg-violet-500/10",
  },
};

interface Props {
  badges: TrustBadgeKind[];
  size?: "sm" | "md";
  className?: string;
}

export function TrustBadges({ badges, size = "sm", className }: Props) {
  if (!badges.length) return null;
  const sizing =
    size === "sm"
      ? "gap-1 px-2 py-0.5 text-[10px]"
      : "gap-1.5 px-2.5 py-1 text-xs";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {badges.map((kind) => {
          const cfg = CONFIG[kind];
          const Icon = cfg.Icon;
          return (
            <Tooltip key={kind}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center rounded-full border font-medium uppercase tracking-wide",
                    sizing,
                    cfg.tone,
                  )}
                  aria-label={cfg.label}
                >
                  <Icon className={iconSize} />
                  <span className="ml-1">{cfg.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <div className="font-semibold">{cfg.label}</div>
                <div className="mt-1 text-muted-foreground">{cfg.explain}</div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
