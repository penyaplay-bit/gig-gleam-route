// Minimal artist dashboard landing — fuller build lands in the Artist Dashboard slice.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/gigs/profile.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, MessageCircle, Music4 } from "lucide-react";

export const Route = createFileRoute("/_signedin/artist")({
  head: () => ({ meta: [{ title: "Artist dashboard — Fare Deal" }, { name: "robots", content: "noindex" }] }),
  component: ArtistDashboard,
});

function ArtistDashboard() {
  const fetchRoles = useServerFn(getMyRoles);
  const { data } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles({}) });
  const artist = data?.artist;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display">Welcome{artist?.stage_name ? `, ${artist.stage_name}` : ""}</h1>
          <p className="text-sm text-muted-foreground">Your booking hub. Keep your calendar honest so promoters can find you.</p>
        </div>
      </div>

      <Card className="p-5 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <CalendarClock className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h2 className="font-medium">Schedule calibration reminder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Have shows booked outside Fare Deal? Update your schedule so promoters see accurate availability and your booking score stays calibrated.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled>Update availability (coming soon)</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <Music4 className="w-4 h-4 text-primary mb-2" />
          <h3 className="font-medium text-sm">Find gigs</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Browse open promoter briefs.</p>
          <Link to="/find-gigs" className="text-primary text-sm underline underline-offset-2">Open marketplace</Link>
        </Card>
        <Card className="p-4">
          <MessageCircle className="w-4 h-4 text-primary mb-2" />
          <h3 className="font-medium text-sm">My applications</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">Track responses from promoters.</p>
          <Link to="/my-applications" className="text-primary text-sm underline underline-offset-2">View</Link>
        </Card>
        <Card className="p-4">
          <h3 className="font-medium text-sm">Complete your profile</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            {artist?.profile_completed ? "Keep socials, awards and media kit fresh." : "Add bio, socials, awards, media kit and rider notes."}
          </p>
          <Link to="/artist/profile" className="text-primary text-sm underline underline-offset-2">Edit credibility profile</Link>
        </Card>
        </Card>
      </div>
    </div>
  );
}
