// Sign-in / sign-up for staff, promoters, and managers.
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { LogoLockup } from "@/components/brand/logo-mark";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapProfile } from "@/lib/gigs/profile.functions";

const searchSchema = z
  .object({ next: z.string().optional(), forbidden: z.string().optional() })
  .default({});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — Fare Deal Bookings" },
      { name: "description", content: "Sign in as a promoter, manager, or staff to access the Fare Deal marketplace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Role = "artist" | "manager" | "promoter";

function AuthPage() {
  const navigate = useNavigate();
  const { next, forbidden } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("artist");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [stageName, setStageName] = useState("");
  const [companyOrAgency, setCompanyOrAgency] = useState("");
  const [busy, setBusy] = useState(false);
  const bootstrap = useServerFn(bootstrapProfile);

  async function routeToRoleHome() {
    // Try to detect admin/staff — otherwise send by role.
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const roleSet = new Set((roles ?? []).map((r) => r.role));
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        window.location.href = next;
        return;
      }
      if (roleSet.has("admin") || roleSet.has("staff")) {
        navigate({ to: "/_authenticated/admin/pipeline" as never });
        return;
      }
      if (roleSet.has("artist")) return navigate({ to: "/artist" as never });
      if (roleSet.has("promoter")) return navigate({ to: "/my-gigs" });
      if (roleSet.has("manager")) return navigate({ to: "/find-gigs" });
    }
    navigate({ to: "/find-gigs" });
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!name.trim()) throw new Error("Please tell us your name");
        if (!whatsapp.trim()) throw new Error("WhatsApp number is required");
        if (role === "artist" && !stageName.trim()) throw new Error("Stage name is required");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        try {
          await bootstrap({
            data: {
              role,
              contact_name: name,
              whatsapp_number: whatsapp,
              stage_name: role === "artist" ? stageName : undefined,
              company_or_agency: role !== "artist" ? companyOrAgency || undefined : undefined,
            },
          });
        } catch (bErr) {
          console.warn("bootstrap failed", bErr);
        }
        toast.success("Account created.");
      }
      await routeToRoleHome();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await routeToRoleHome();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex justify-center">
          <LogoLockup />
        </Link>

        <Card className="p-6 border-primary/20 bg-card/60 backdrop-blur">
          <h1 className="text-xl font-display mb-1">{mode === "signin" ? "Welcome back" : "Join Fare Deal"}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Sign in to your marketplace account." : "Create your account to start booking."}
          </p>

          {forbidden && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              You don't have access to that area.
            </div>
          )}

          {mode === "signup" && (
            <div className="mb-4">
              <Label>I am a…</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setRole("manager")}
                  className={`rounded-md border px-3 py-2 text-sm transition ${role === "manager" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  Manager / Agent
                </button>
                <button
                  type="button"
                  onClick={() => setRole("promoter")}
                  className={`rounded-md border px-3 py-2 text-sm transition ${role === "promoter" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  Promoter
                </button>
              </div>
              <p className="text-[11px] mt-2 text-muted-foreground">
                {role === "manager" ? "Browse gigs and apply on behalf of artists in your roster." : "Post gigs and receive applications from managers."}
              </p>
            </div>
          )}

          <Button type="button" variant="outline" className="w-full mb-4" onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or email</span>
            </div>
          </div>

          <form onSubmit={handlePassword} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : `Create ${role} account`}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "No account? Create one" : "Have an account? Sign in"}
          </button>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Just browsing? <Link to="/find-gigs" className="text-primary underline underline-offset-2">Explore open gigs</Link>
        </p>
      </div>
    </div>
  );
}
