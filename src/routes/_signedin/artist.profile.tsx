// Artist owner: edit the six credibility sections + availability.
// OAuth ingestion for followers is a follow-up slice; v1 is manual entry
// for handles + counts, media links, and awards.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  getMyArtistProfile, updateArtistProfile,
  upsertSocial, deleteSocial,
  upsertAward, deleteAward,
  upsertMedia, deleteMedia,
  requestVerification,
} from "@/lib/artists/profile.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ShieldCheck, ExternalLink, User, Trophy, BarChart3, Image as ImgIcon, Radio, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_signedin/artist/profile")({
  head: () => ({ meta: [{ title: "Edit artist profile — Fare Deal" }, { name: "robots", content: "noindex" }] }),
  component: EditArtistProfile,
});

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify (monthly listeners)",
  apple_music: "Apple Music (monthly listeners)",
  youtube: "YouTube (subscribers)",
  tiktok: "TikTok (followers)",
  instagram: "Instagram (followers)",
  facebook: "Facebook (followers)",
  x: "X (followers)",
  audiomack: "Audiomack (followers)",
  deezer: "Deezer (followers)",
};
const AWARD_TIERS = ["platinum","gold","nominee","win","recognition"];
const MEDIA_KINDS = ["photo","video","stage_plot","tech_rider","hospitality","press","music"];
const VERIF_KINDS: { kind: string; label: string }[] = [
  { kind: "id", label: "Government ID" },
  { kind: "phone", label: "Phone" },
  { kind: "email", label: "Email" },
  { kind: "management", label: "Management" },
  { kind: "bank", label: "Bank" },
  { kind: "tax", label: "Tax compliant" },
];

function EditArtistProfile() {
  const fetchProfile = useServerFn(getMyArtistProfile);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-artist-profile"], queryFn: () => fetchProfile() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-artist-profile"] });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  if (!data.profile) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Complete your artist signup first.</p>
        <Link to="/artist" className="text-primary underline mt-2 inline-block">Go to dashboard</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display">Edit credibility profile</h1>
          <p className="text-sm text-muted-foreground">Promoters see this. Fill it fully — your Booking Intelligence Score depends on it.</p>
        </div>
        {data.stats?.intelligence_score != null && (
          <Card className="px-4 py-3 border-primary/30 bg-primary/5">
            <div className="text-[10px] uppercase tracking-widest text-primary">Booking Intelligence</div>
            <div className="font-display text-3xl text-goldleaf">{data.stats.intelligence_score}<span className="text-muted-foreground text-base">/100</span></div>
            {data.stats.tier && <div className="text-xs text-muted-foreground">{data.stats.tier}</div>}
          </Card>
        )}
      </header>

      <Tabs defaultValue="basics" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="basics"><User className="w-3 h-3 mr-1" />Basics</TabsTrigger>
          <TabsTrigger value="reach"><BarChart3 className="w-3 h-3 mr-1" />Reach</TabsTrigger>
          <TabsTrigger value="awards"><Trophy className="w-3 h-3 mr-1" />Awards</TabsTrigger>
          <TabsTrigger value="media"><ImgIcon className="w-3 h-3 mr-1" />Media kit</TabsTrigger>
          <TabsTrigger value="availability"><CalendarClock className="w-3 h-3 mr-1" />Availability</TabsTrigger>
          <TabsTrigger value="verify"><ShieldCheck className="w-3 h-3 mr-1" />Verify</TabsTrigger>
        </TabsList>

        <TabsContent value="basics"><BasicsTab profile={data.profile} onSaved={invalidate} /></TabsContent>
        <TabsContent value="reach"><ReachTab socials={data.socials} onChanged={invalidate} /></TabsContent>
        <TabsContent value="awards"><AwardsTab awards={data.awards} onChanged={invalidate} /></TabsContent>
        <TabsContent value="media"><MediaTab media={data.media} onChanged={invalidate} /></TabsContent>
        <TabsContent value="availability"><AvailabilityTab profile={data.profile} onSaved={invalidate} /></TabsContent>
        <TabsContent value="verify"><VerifyTab verifications={data.verifications} onChanged={invalidate} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Basics ============
function BasicsTab({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const save = useServerFn(updateArtistProfile);
  const [form, setForm] = useState({
    stage_name: profile.stage_name ?? "",
    bio: profile.bio ?? "",
    genres: (profile.genres ?? []).join(", "),
    location_city: profile.location_city ?? "",
    location_country: profile.location_country ?? "",
    photo_url: profile.photo_url ?? "",
    booking_fee_min_cents: profile.booking_fee_min_cents ?? "",
    booking_fee_max_cents: profile.booking_fee_max_cents ?? "",
    currency: profile.currency ?? "ZAR",
    rider_notes: profile.rider_notes ?? "",
    regional_strength: (profile.regional_strength ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: {
        stage_name: form.stage_name,
        bio: form.bio || undefined,
        genres: form.genres.split(",").map((s: string) => s.trim()).filter(Boolean),
        location_city: form.location_city || null,
        location_country: form.location_country || null,
        photo_url: form.photo_url || null,
        booking_fee_min_cents: form.booking_fee_min_cents === "" ? null : Number(form.booking_fee_min_cents),
        booking_fee_max_cents: form.booking_fee_max_cents === "" ? null : Number(form.booking_fee_max_cents),
        currency: form.currency,
        rider_notes: form.rider_notes || null,
        regional_strength: form.regional_strength.split(",").map((s: string) => s.trim()).filter(Boolean),
      }});
      toast.success("Saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>Stage name</Label>
          <Input value={form.stage_name} onChange={e => setForm({ ...form, stage_name: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label>Bio</Label>
          <Textarea rows={5} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Two-paragraph promoter pitch." />
        </div>
        <div>
          <Label>Genres (comma-separated)</Label>
          <Input value={form.genres} onChange={e => setForm({ ...form, genres: e.target.value })} placeholder="Famo, Afro-Soul" />
        </div>
        <div>
          <Label>Hero photo URL</Label>
          <Input value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })} />
        </div>
        <div>
          <Label>City</Label>
          <Input value={form.location_city} onChange={e => setForm({ ...form, location_city: e.target.value })} />
        </div>
        <div>
          <Label>Country</Label>
          <Input value={form.location_country} onChange={e => setForm({ ...form, location_country: e.target.value })} />
        </div>
        <div>
          <Label>Fee min (cents)</Label>
          <Input type="number" value={form.booking_fee_min_cents} onChange={e => setForm({ ...form, booking_fee_min_cents: e.target.value })} />
        </div>
        <div>
          <Label>Fee max (cents)</Label>
          <Input type="number" value={form.booking_fee_max_cents} onChange={e => setForm({ ...form, booking_fee_max_cents: e.target.value })} />
        </div>
        <div>
          <Label>Currency</Label>
          <Input maxLength={3} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <Label>Regional strength (comma-separated cities/regions)</Label>
          <Input value={form.regional_strength} onChange={e => setForm({ ...form, regional_strength: e.target.value })} placeholder="Lesotho, Free State, Gauteng" />
        </div>
        <div className="md:col-span-2">
          <Label>Rider notes</Label>
          <Textarea rows={3} value={form.rider_notes} onChange={e => setForm({ ...form, rider_notes: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save basics"}</Button>
        </div>
      </form>
    </Card>
  );
}

// ============ Reach ============
function ReachTab({ socials, onChanged }: { socials: any[]; onChanged: () => void }) {
  const upsert = useServerFn(upsertSocial);
  const del = useServerFn(deleteSocial);
  const byPlatform = new Map(socials.map(s => [s.platform, s]));
  const total = socials.reduce((sum, s) => sum + (s.followers || 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-5 border-primary/30 bg-primary/5">
        <div className="text-[10px] uppercase tracking-widest text-primary">Total audience reach</div>
        <div className="font-display text-4xl text-goldleaf">{total.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground mt-1">Sum of all platforms below. OAuth auto-sync for Spotify, YouTube, TikTok, X is next up — for now enter counts manually.</p>
      </Card>
      <div className="grid gap-3">
        {Object.entries(PLATFORM_LABELS).map(([platform, label]) => (
          <SocialRow
            key={platform}
            platform={platform}
            label={label}
            existing={byPlatform.get(platform)}
            onSave={async (payload) => { await upsert({ data: { platform: platform as any, ...payload } }); toast.success("Saved"); onChanged(); }}
            onDelete={async () => {
              const row = byPlatform.get(platform);
              if (!row) return;
              await del({ data: { id: row.id } }); toast.success("Removed"); onChanged();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SocialRow({ platform, label, existing, onSave, onDelete }: {
  platform: string; label: string; existing: any;
  onSave: (p: { handle: string | null; url: string | null; followers: number }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [handle, setHandle] = useState(existing?.handle ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [followers, setFollowers] = useState<number | "">(existing?.followers ?? "");
  useEffect(() => {
    setHandle(existing?.handle ?? "");
    setUrl(existing?.url ?? "");
    setFollowers(existing?.followers ?? "");
  }, [existing]);
  return (
    <Card className="p-4">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.5fr_140px_auto] items-end">
        <div>
          <Label className="text-xs">{label}</Label>
          <Input placeholder="handle" value={handle} onChange={e => setHandle(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">URL</Label>
          <Input placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
        </div>
        <div />
        <div>
          <Label className="text-xs">Followers</Label>
          <Input type="number" value={followers} onChange={e => setFollowers(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={() => onSave({ handle: handle || null, url: url || null, followers: typeof followers === "number" ? followers : 0 })}
          >Save</Button>
          {existing && (
            <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-4 h-4" /></Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============ Awards ============
function AwardsTab({ awards, onChanged }: { awards: any[]; onChanged: () => void }) {
  const upsert = useServerFn(upsertAward);
  const del = useServerFn(deleteAward);
  const [draft, setDraft] = useState({ name: "", organisation: "", year: "", tier: "" });

  async function add() {
    if (!draft.name) return;
    try {
      await upsert({ data: {
        name: draft.name,
        organisation: draft.organisation || null,
        year: draft.year ? Number(draft.year) : null,
        tier: (draft.tier || null) as any,
      }});
      setDraft({ name: "", organisation: "", year: "", tier: "" });
      toast.success("Added"); onChanged();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_100px_140px_auto] items-end">
          <div><Label className="text-xs">Award / recognition</Label><Input value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="SAMA Best Male Artist" /></div>
          <div><Label className="text-xs">Organisation</Label><Input value={draft.organisation} onChange={e => setDraft({...draft, organisation: e.target.value})} /></div>
          <div><Label className="text-xs">Year</Label><Input type="number" value={draft.year} onChange={e => setDraft({...draft, year: e.target.value})} /></div>
          <div>
            <Label className="text-xs">Tier</Label>
            <Select value={draft.tier} onValueChange={v => setDraft({...draft, tier: v})}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{AWARD_TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!draft.name}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>
      </Card>
      {awards.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No awards yet.</Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {awards.map(a => (
            <Card key={a.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[a.organisation, a.year, a.tier].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={async () => { await del({ data: { id: a.id } }); onChanged(); }}><Trash2 className="w-4 h-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Media ============
function MediaTab({ media, onChanged }: { media: any[]; onChanged: () => void }) {
  const upsert = useServerFn(upsertMedia);
  const del = useServerFn(deleteMedia);
  const [draft, setDraft] = useState({ kind: "photo", url: "", caption: "" });

  async function add() {
    if (!draft.url) return;
    try {
      await upsert({ data: { kind: draft.kind as any, url: draft.url, caption: draft.caption || null } });
      setDraft({ kind: draft.kind, url: "", caption: "" });
      toast.success("Added"); onChanged();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-2 md:grid-cols-[160px_2fr_1.5fr_auto] items-end">
          <div>
            <Label className="text-xs">Kind</Label>
            <Select value={draft.kind} onValueChange={v => setDraft({...draft, kind: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MEDIA_KINDS.map(k => <SelectItem key={k} value={k}>{k.replace("_"," ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">URL</Label><Input placeholder="https://…" value={draft.url} onChange={e => setDraft({...draft, url: e.target.value})} /></div>
          <div><Label className="text-xs">Caption</Label><Input value={draft.caption} onChange={e => setDraft({...draft, caption: e.target.value})} /></div>
          <Button onClick={add} disabled={!draft.url}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>
      </Card>
      {media.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nothing in your media kit yet.</Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {media.map(m => (
            <Card key={m.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{m.kind.replace("_"," ")}</Badge>
                  {m.caption && <span className="text-sm truncate">{m.caption}</span>}
                </div>
                <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 truncate">
                  <ExternalLink className="w-3 h-3" /> {m.url}
                </a>
              </div>
              <Button size="sm" variant="ghost" onClick={async () => { await del({ data: { id: m.id } }); onChanged(); }}><Trash2 className="w-4 h-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Availability ============
function AvailabilityTab({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const save = useServerFn(updateArtistProfile);
  const [status, setStatus] = useState<string>(profile.availability_status ?? "available");
  async function submit() {
    try {
      await save({ data: { availability_status: status as any } });
      toast.success("Updated"); onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Card className="p-6 space-y-4">
      <div>
        <Label>Current status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="on_tour">On tour</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="tentative">Tentative</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1"><Radio className="w-3 h-3" /> Calendar view with per-date overrides ships in the next update.</p>
      <Button onClick={submit}>Save status</Button>
    </Card>
  );
}

// ============ Verify ============
function VerifyTab({ verifications, onChanged }: { verifications: any[]; onChanged: () => void }) {
  const request = useServerFn(requestVerification);
  const byKind = new Map(verifications.map(v => [v.kind, v]));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {VERIF_KINDS.map(({ kind, label }) => {
        const v = byKind.get(kind);
        const status = v?.status ?? "not_requested";
        const done = status === "verified";
        return (
          <Card key={kind} className={`p-4 flex items-center justify-between gap-3 ${done ? "border-primary/40 bg-primary/5" : ""}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${done ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className="font-medium">{label}</div>
                <div className="text-xs text-muted-foreground capitalize">{status.replace("_", " ")}</div>
              </div>
            </div>
            <Button
              size="sm"
              variant={done ? "ghost" : "outline"}
              disabled={done || status === "pending"}
              onClick={async () => { await request({ data: { kind: kind as any } }); toast.success("Requested"); onChanged(); }}
            >
              {done ? "Verified" : status === "pending" ? "Pending review" : "Request"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
