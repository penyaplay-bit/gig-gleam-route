import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Package, Calendar, LogOut, Table2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminShell,
});

function AdminShell() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" as never, replace: true });
  }

  const nav = [
    { to: "/admin/pipeline", label: "Pipeline", Icon: LayoutDashboard },
    { to: "/admin/bookings", label: "Bookings", Icon: Table2 },
    { to: "/admin/calendar", label: "Calendar", Icon: Calendar },
    { to: "/admin/packages", label: "Packages", Icon: Package },
    { to: "/admin/promoters", label: "Promoters", Icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-primary/10 bg-background/70 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-primary">◆</span>
              <span className="font-display tracking-wider text-sm">PENYA PLAY <span className="text-primary">OS</span></span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {nav.map(({ to, label, Icon }) => (
                <Link
                  key={to}
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
              key={to}
              to={to as never}
              className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground whitespace-nowrap"
              activeProps={{ className: "flex items-center gap-1 px-3 py-2 text-xs text-primary whitespace-nowrap" }}
            >
              <Icon className="w-3 h-3" /> {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
