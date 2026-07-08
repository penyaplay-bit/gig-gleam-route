// Promoter: post a new gig.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createGig } from "@/lib/gigs/gigs.functions";
import { bootstrapProfile, getMyRoles } from "@/lib/gigs/profile.functions";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_signedin/post-gig")({
  component: PostGigPage,
});

function PostGigPage() {
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyRoles);
  const bootstrap = useServerFn(bootstrapProfile);
  const create = useServerFn(createGig);
  const { data: roleData, refetch } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });

  const hasPromoterProfile = !!roleData?.promoter;
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");

  const [form, setForm] = useState({
    event_name: "",
    event_type: "concert",
    event_date: "",
    venue: "",
    city: "",
    country: "South Africa",
    crowd_size: 500,
    budget_low: 20000,
    budget_high: 60000,
    genres: "",
    types: "",
    deadline: "",
    description: "",
  });
  const [busy, setBusy] = useState(false);

  async function bootstrapPromoter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await bootstrap({ data: { role: "promoter", contact_name: contactName, phone, company_or_agency: company } });
      toast.success("Promoter profile ready.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await create({
        data: {
          event_name: form.event_name,
          event_type: form.event_type,
          event_date: form.event_date,
          venue: form.venue,
          city: form.city,
          country: form.country,
          crowd_size: Number(form.crowd_size),
          budget_low_cents: Math.round(Number(form.budget_low) * 100),
          budget_high_cents: Math.round(Number(form.budget_high) * 100),
          currency: "ZAR",
          genre_needed: form.genres.split(",").map((s) => s.trim()).filter(Boolean),
          artist_type_needed: form.types.split(",").map((s) => s.trim()).filter(Boolean),
          application_deadline: form.deadline,
          description: form.description || undefined,
        },
      });
      toast.success("Gig submitted for review!");
      navigate({ to: "/my-gigs" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally { setBusy(false); }
  }

  if (!roleData) return <p className="text-muted-foreground">Loading…</p>;

  if (!hasPromoterProfile) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-display mb-2">Set up your promoter profile</h1>
        <p className="text-muted-foreground mb-6">One-time setup. Takes 30 seconds.</p>
        <Card className="p-6">
          <form onSubmit={bootstrapPromoter} className="space-y-3">
            <div>
              <Label>Your name</Label>
              <Input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Company / brand (optional)</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">Continue</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-display mb-2">Post a gig</h1>
      <p className="text-muted-foreground mb-6">Managers will apply with artists from their roster. Admin reviews before it goes live.</p>
      <Card className="p-6">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Event name</Label>
            <Input required value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
          </div>
          <div>
            <Label>Event type</Label>
            <Input required value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} />
          </div>
          <div>
            <Label>Event date</Label>
            <Input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Venue</Label>
            <Input required value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </div>
          <div>
            <Label>City</Label>
            <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <Label>Country</Label>
            <Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <Label>Expected crowd</Label>
            <Input type="number" required value={form.crowd_size} onChange={(e) => setForm({ ...form, crowd_size: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Application deadline</Label>
            <Input type="date" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div>
            <Label>Budget low (ZAR)</Label>
            <Input type="number" required value={form.budget_low} onChange={(e) => setForm({ ...form, budget_low: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Budget high (ZAR)</Label>
            <Input type="number" required value={form.budget_high} onChange={(e) => setForm({ ...form, budget_high: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-2">
            <Label>Genres needed (comma-separated)</Label>
            <Input value={form.genres} onChange={(e) => setForm({ ...form, genres: e.target.value })} placeholder="amapiano, house, afrobeats" />
          </div>
          <div className="md:col-span-2">
            <Label>Artist type (comma-separated)</Label>
            <Input value={form.types} onChange={(e) => setForm({ ...form, types: e.target.value })} placeholder="dj, live-band, vocalist" />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Tell managers about the event, vibe, stage setup, etc." />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
