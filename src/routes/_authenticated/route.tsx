// Managed auth gate for /admin/*. Redirects to /auth if signed out.
// NOTE: matches "tanstack-supabase-integration" pattern — ssr: false.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
    // Verify admin/staff role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = !!roles?.some((r) => r.role === "admin" || r.role === "staff");
    if (!isAdmin) {
      throw redirect({ to: "/auth", search: { next: location.href, forbidden: "1" } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
