// Pathless layout for any signed-in user (promoters, managers, artists).
// Distinct from _authenticated which additionally enforces admin/staff.
import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutGrid, ClipboardList, Send, Users2, LogOut, Sparkles, Brain } from "lucide-react";
import { CinematicBackdrop } from "@/components/brand/cinematic-backdrop";

export const Route = createFileRoute("/_signedin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
    return { user: data.user };
  },
  component: SignedInShell,
});

function SignedInShell() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
  const nav = [
    { to: "/concierge", label: "Concierge", Icon: Sparkles },
    { to: "/find-gigs", label: "Find Gigs", Icon: LayoutGrid },
    { to: "/my-applications", label: "My Applications", Icon: ClipboardList },
    { to: "/my-roster", label: "My Roster", Icon: Users2 },
    { to: "/post-gig", label: "Post Gig", Icon: Send },
    { to: "/my-gigs", label: "My Gigs", Icon: Sparkles },
  ];
  return (
    <div className="relative min-h-screen text-foreground">
      <div className="fixed inset-0 z-0"><CinematicBackdrop variant="ambient" /></div>
      <header className="relative z-30 border-b border-primary/10 bg-background/60 sticky top-0 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-primary">◆</span>
              <span className="font-display tracking-wider text-sm">FARE DEAL <span className="text-primary">MARKET</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {nav.map(({ to, label, Icon }) => (
                <Link
                  key={label}
                  to={to as never}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                  activeProps={{ className: "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-foreground bg-primary/10" }}
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              ))}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
        </div>
        <nav className="md:hidden flex overflow-x-auto border-t border-border/50 px-2">
          {nav.map(({ to, label, Icon }) => (
            <Link
              key={label}
              to={to as never}
              className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground whitespace-nowrap"
              activeProps={{ className: "flex items-center gap-1 px-3 py-2 text-xs text-primary whitespace-nowrap" }}
            >
              <Icon className="w-3 h-3" /> {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
