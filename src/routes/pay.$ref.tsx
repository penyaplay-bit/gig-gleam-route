// Public deposit page: shows invoice, accepts POP upload, shows verification status.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDateLong, formatM } from "@/lib/formatting";
import { LogoLockup } from "@/components/brand/logo-mark";
import { GrainOverlay } from "@/components/brand/grain";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";

export const Route = createFileRoute("/pay/$ref")({
  head: ({ params }) => ({
    meta: [
      { title: `Pay deposit — ${params.ref}` },
      { name: "description", content: "Upload proof of payment for your Penya Play booking deposit." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayPage,
});

interface Booking {
  ref: string;
  event_name: string;
  event_date: string;
  city: string;
  country: string;
  venue: string | null;
  status: string;
  quoted_amount: number | null;
  deposit_amount: number | null;
  deposit_pct: number;
  balance_amount: number | null;
  contact_name: string;
  artists: { name: string } | null;
  packages: { name: string } | null;
  deposits: Array<{ id: string; status: string; uploaded_at: string | null; verified_at: string | null }>;
}

function PayPage() {
  const { ref } = Route.useParams();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pay", ref],
    queryFn: async () => {
      const r = await fetch(`/api/public/bookings/${ref}`);
      if (!r.ok) throw new Error("Booking not found");
      return (await r.json()) as { booking: Booking };
    },
  });

  const b = data?.booking;

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Choose a file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("method", "bank_transfer");
      fd.set("reference", reference);
      const r = await fetch(`/api/public/deposits/${ref}`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Upload failed");
      toast.success("Proof uploaded. Awaiting verification.");
      setFile(null);
      setReference("");
      qc.invalidateQueries({ queryKey: ["pay", ref] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="fixed inset-0 z-0 pointer-events-none"><CinematicBackdrop variant="ambient" /></div>
      <GrainOverlay />
      <header className="border-b border-primary/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/"><LogoLockup /></Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-display text-4xl font-black">Deposit for <span className="text-goldleaf">{ref}</span></h1>


        {isLoading ? (
          <p className="mt-6 text-muted-foreground">Loading…</p>
        ) : !b ? (
          <p className="mt-6 text-red-400">Booking not found.</p>
        ) : !b.quoted_amount ? (
          <Card className="mt-6 p-6 border-amber-500/30 bg-amber-500/5">
            <p className="text-amber-200">
              No quote has been issued yet for this booking. Please wait for our ops team to send a quote before paying.
            </p>
          </Card>
        ) : (
          <>
            <Card className="mt-6 p-6 border-primary/20 bg-card/60">
              <h2 className="font-display text-lg">{b.event_name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {b.artists?.name} · {formatDateLong(b.event_date)} · {b.city}, {b.country}
              </p>

              <div className="mt-6 space-y-2 text-sm">
                <Row label="Total quoted" value={formatM(b.quoted_amount)} />
                <Row label={`Deposit due (${b.deposit_pct}%)`} value={formatM(b.deposit_amount)} strong />
                <Row label="Balance (before performance)" value={formatM(b.balance_amount)} />
              </div>

              <div className="mt-6 rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm">
                <div className="font-semibold text-primary">Bank transfer details</div>
                <dl className="mt-2 grid grid-cols-3 gap-y-1">
                  <dt className="text-muted-foreground">Bank</dt><dd className="col-span-2 font-mono">Standard Lesotho</dd>
                  <dt className="text-muted-foreground">Account</dt><dd className="col-span-2 font-mono">9080 XXXX XXXX</dd>
                  <dt className="text-muted-foreground">Account name</dt><dd className="col-span-2 font-mono">Penya Play Music</dd>
                  <dt className="text-muted-foreground">Reference</dt><dd className="col-span-2 font-mono text-primary">{ref}</dd>
                </dl>
              </div>
            </Card>

            <Card className="mt-6 p-6 border-primary/20 bg-card/60">
              <h3 className="font-display text-lg">Upload proof of payment</h3>
              <p className="text-sm text-muted-foreground">PNG, JPG, WEBP, or PDF up to 8 MB.</p>

              <form onSubmit={upload} className="mt-4 space-y-4">
                <div>
                  <Label>Bank reference / receipt no. (optional)</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={160} />
                </div>
                <div>
                  <Label>Proof of payment</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button type="submit" disabled={busy || !file}>
                  {busy ? "Uploading…" : "Upload proof"}
                </Button>
              </form>
            </Card>

            {b.deposits && b.deposits.length > 0 && (
              <Card className="mt-6 p-6 border-primary/10 bg-card/40">
                <h4 className="text-sm font-semibold mb-3">Payment history</h4>
                <ul className="space-y-2 text-sm">
                  {b.deposits.map((d) => (
                    <li key={d.id} className="flex items-center justify-between rounded border border-border/60 p-3">
                      <span>Uploaded {d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : "—"}</span>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs border " +
                          (d.status === "verified"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : d.status === "rejected"
                            ? "bg-red-500/10 text-red-300 border-red-500/30"
                            : "bg-yellow-500/10 text-yellow-300 border-yellow-500/30")
                        }
                      >
                        {d.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-border/40 py-2 ${strong ? "text-primary font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
