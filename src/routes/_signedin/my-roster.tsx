// Manager: manage roster of representable artists.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMyRoster, upsertRosterArtist, deleteRosterArtist } from "@/lib/gigs/roster.functions";
import { bootstrapProfile, getMyRoles } from "@/lib/gigs/profile.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_signedin/my-roster")({
  component: RosterPage,
});

function RosterPage() {
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyRoles);
  const bootstrap = useServerFn(bootstrapProfile);
  const fetchRoster = useServerFn(listMyRoster);
  const upsert = useServerFn(upsertRosterArtist);
  const remove = useServerFn(deleteRosterArtist);

  const { data: roleData, refetch: refetchRoles } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const { data: rosterData } = useQuery({
    queryKey: ["my-roster"],
    queryFn: () => fetchRoster(),
    enabled: !!roleData?.manager,
  });

  const [contactName, setContactName] = useState("");
  const [agency, setAgency] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ artist_name: "", genre: "", artist_type: "", base_city: "", bio: "", rate_hint: "" });

  async function bootstrapMgr(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await bootstrap({ data: { role: "manager", contact_name: contactName, company_or_agency: agency } });
      toast.success("Manager profile ready.");
      await refetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  async function addArtist(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await upsert({
        data: {
          artist_name: form.artist_name,
          genre: form.genre || undefined,
          artist_type: form.artist_type || undefined,
          base_city: form.base_city || undefined,
          bio: form.bio || undefined,
          rate_hint_cents: form.rate_hint ? Math.round(Number(form.rate_hint) * 100) : undefined,
          currency: "ZAR",
          active: true,
        },
      });
      toast.success("Artist added");
      setForm({ artist_name: "", genre: "", artist_type: "", base_city: "", bio: "", rate_hint: "" });
      qc.invalidateQueries({ queryKey: ["my-roster"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    try {
      await remove({ data: { id } });
      qc.invalidateQueries({ queryKey: ["my-roster"] });
      toast.success("Removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!roleData) return <p className="text-muted-foreground">Loading…</p>;

  if (!roleData.manager) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-display mb-2">Set up your manager profile</h1>
        <p className="text-muted-foreground mb-6">Then you can add artists to your roster and apply to gigs.</p>
        <Card className="p-6">
          <form onSubmit={bootstrapMgr} className="space-y-3">
            <div>
              <Label>Your name</Label>
              <Input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Agency / brand (optional)</Label>
              <Input value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">Continue</Button>
          </form>
        </Card>
      </div>
    );
  }

  const roster = rosterData?.roster ?? [];

  return (
    <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-[1fr_380px]">
      <div>
        <h1 className="text-3xl font-display mb-4">My roster</h1>
        {roster.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No artists yet. Add your first one →
          </Card>
        ) : (
          <div className="grid gap-3">
            {roster.map((r: any) => (
              <Card key={r.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display">{r.artist_name}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.genre && <Badge variant="outline" className="text-[10px]">{r.genre}</Badge>}
                    {r.artist_type && <Badge variant="outline" className="text-[10px]">{r.artist_type}</Badge>}
                    {r.base_city && <Badge variant="outline" className="text-[10px]">{r.base_city}</Badge>}
                  </div>
                  {r.bio && <p className="text-xs mt-2 text-muted-foreground line-clamp-2">{r.bio}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Card className="p-6 h-fit sticky top-24">
        <h2 className="font-display text-lg mb-4">Add artist</h2>
        <form onSubmit={addArtist} className="space-y-3">
          <div><Label>Artist name</Label><Input required value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} /></div>
          <div><Label>Genre</Label><Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="amapiano" /></div>
          <div><Label>Artist type</Label><Input value={form.artist_type} onChange={(e) => setForm({ ...form, artist_type: e.target.value })} placeholder="dj / band / vocalist" /></div>
          <div><Label>Base city</Label><Input value={form.base_city} onChange={(e) => setForm({ ...form, base_city: e.target.value })} /></div>
          <div><Label>Typical rate (ZAR)</Label><Input type="number" value={form.rate_hint} onChange={(e) => setForm({ ...form, rate_hint: e.target.value })} /></div>
          <div><Label>Short bio</Label><Textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <Button type="submit" disabled={busy} className="w-full">Add artist</Button>
        </form>
      </Card>
    </div>
  );
}
