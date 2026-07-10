// Slice A — Universal onboarding: pick your role(s) + reserve your Booking Button handle.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles, Mic2, HeartHandshake, Building2, CalendarClock, Wrench, Users2, Megaphone, Check,
} from "lucide-react";
import { saveOnboarding, getMyOnboarding } from "@/lib/onboarding/intents.functions";

export const Route = createFileRoute("/_signedin/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to Penya Play" },
      { name: "description", content: "Tell Penya Play what brings you here and reserve your Booking Button URL." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WelcomePage,
});

type IntentKey =
  | "get_booked" | "hire_talent" | "list_venue" | "organize_events"
  | "provide_services" | "manage_talent" | "represent_brand";

const INTENTS: { key: IntentKey; title: string; sub: string; Icon: typeof Mic2; handleKind: string }[] = [
  { key: "get_booked", title: "I want to get booked", sub: "Musician, DJ, MC, dancer, speaker, actor…", Icon: Mic2, handleKind: "performer" },
  { key: "hire_talent", title: "I want to hire talent", sub: "For a party, wedding, or event", Icon: HeartHandshake, handleKind: "promoter" },
  { key: "list_venue", title: "I own a venue", sub: "Club, lounge, hotel, hall, arena…", Icon: Building2, handleKind: "venue" },
  { key: "organize_events", title: "I organize events", sub: "Promoter, festival, corporate, brand…", Icon: CalendarClock, handleKind: "promoter" },
  { key: "provide_services", title: "I provide event services", sub: "Sound, lighting, stage, catering, security…", Icon: Wrench, handleKind: "supplier" },
  { key: "manage_talent", title: "I manage talent", sub: "Agent, manager, label", Icon: Users2, handleKind: "manager" },
  { key: "represent_brand", title: "I represent a brand", sub: "Sponsorship, activations, partnerships", Icon: Megaphone, handleKind: "brand" },
];

function WelcomePage() {
  const navigate = useNavigate();
  const load = useServerFn(getMyOnboarding);
  const save = useServerFn(saveOnboarding);

  const { data } = useQuery({ queryKey: ["my-onboarding"], queryFn: () => load() });

  const [selected, setSelected] = useState<Set<IntentKey>>(new Set());
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSelected(new Set(data.intents as IntentKey[]));
    if (data.handle) {
      setHandle(data.handle.handle ?? "");
      setDisplayName(data.handle.display_name ?? "");
    }
  }, [data]);

  const primaryKind = useMemo(() => {
    // Prefer performer > venue > supplier > promoter > brand > manager
    const order: IntentKey[] = [
      "get_booked", "list_venue", "provide_services",
      "organize_events", "hire_talent", "represent_brand", "manage_talent",
    ];
    for (const key of order) if (selected.has(key)) {
      return INTENTS.find((i) => i.key === key)!.handleKind;
    }
    return "performer";
  }, [selected]);

  const canSubmit = selected.size > 0 && /^[a-z0-9][a-z0-9_-]{2,31}$/.test(handle) && displayName.trim().length > 0;

  function toggle(k: IntentKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await save({
        data: {
          intents: Array.from(selected),
          handle: handle.toLowerCase(),
          handleKind: primaryKind as never,
          displayName: displayName.trim(),
        },
      });
      toast.success("Welcome aboard — your Booking Button is live.");
      navigate({ to: "/artist" as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-primary">
          <Sparkles className="w-3.5 h-3.5" /> Welcome
        </div>
        <h1 className="font-display text-3xl md:text-4xl">What brings you to Penya Play?</h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Pick every role that fits — you can wear more than one hat. We'll shape the platform around what you do.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {INTENTS.map(({ key, title, sub, Icon }) => {
          const active = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`text-left rounded-xl border p-4 transition ${
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_25px_-10px] shadow-primary/60"
                  : "border-border hover:border-primary/40 bg-card/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {title}
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="p-5 border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="text-primary border-primary/50">Booking Button™</Badge>
          <span className="text-sm text-muted-foreground">Your personal booking page — replaces "DM me for bookings"</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ntate Stunna"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Handle</Label>
            <div className="flex items-center mt-1 rounded-md border border-input bg-background px-2 focus-within:border-primary">
              <span className="text-xs text-muted-foreground">penyaplay.africa/book/</span>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder="ntatestunna"
                className="border-0 shadow-none focus-visible:ring-0 px-1"
                maxLength={32}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">3–32 chars · letters, numbers, - or _</p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" disabled={!canSubmit || busy} onClick={submit}>
          {busy ? "Saving…" : "Reserve my Booking Button"}
        </Button>
      </div>
    </div>
  );
}
