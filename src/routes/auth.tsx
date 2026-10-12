import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SecureConnectionGate } from "@/components/SecureConnectionGate";
import { useState } from "react";
import { Loader2, ShieldCheck, MonitorPlay, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authService } from "@/services";
import type { Role } from "@/lib/roles";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | College of Health CBT Portal" },
      {
        name: "description",
        content:
          "Secure sign in for students, examination administrators and SuperAdmins of the College of Health CBT portal.",
      },
      { property: "og:title", content: "Sign In | College of Health CBT Portal" },
      {
        property: "og:description",
        content: "Secure access to the College of Health computer-based examination portal.",
      },
    ],
  }),
  component: AuthPage,
});

type LoginMode = "student" | "admin" | "superadmin";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LoginMode>("student");
  const [matricNumber, setMatricNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "pending">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("pending");
    setError(null);

    try {
      if (mode === "student") {
        await authService.signIn({ matricNumber, password });
        navigate({ to: "/", replace: true });
      } else {
        const role = await authService.signInStaff({
          email,
          password,
          expectedRole: mode,
        });
        navigate({ to: roleHome(role), replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in right now.");
    } finally {
      setStatus("idle");
    }
  };

  const isStaff = mode !== "student";

  return (
    <SecureConnectionGate>
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="brand-gradient relative hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <img
            src="/college-logo.png"
            alt="Taraba State College of Health Technology, Takum"
            className="size-14 rounded-xl bg-white/95 object-contain p-1"
          />
          <span>
            <span className="block font-display text-lg font-bold">College of Health</span>
            <span className="block text-xs opacity-80">CBT Examination Portal</span>
          </span>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            A calm, focused place to sit your exams.
          </h2>
          <p className="mt-4 text-sm/relaxed opacity-90">
            Secure examination access for students and the staff responsible for running each paper.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs opacity-80">
          <ShieldCheck className="size-4" aria-hidden /> Server-authoritative authentication, timing and scoring
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <h1 className="font-display text-2xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isStaff
              ? `Use your ${mode === "superadmin" ? "SuperAdmin" : "Admin"} account credentials.`
              : "Use the credentials issued by your department."}
          </p>

          <div className="mt-6 grid grid-cols-3 rounded-xl bg-secondary/70 p-1" role="tablist" aria-label="Account type">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "student"}
              onClick={() => {
                setMode("student");
                setError(null);
              }}
              className={`tap-target rounded-lg px-2 text-xs font-semibold transition-colors ${mode === "student" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Student
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "admin"}
              onClick={() => {
                setMode("admin");
                setError(null);
              }}
              className={`tap-target rounded-lg px-2 text-xs font-semibold transition-colors ${mode === "admin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Admin
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "superadmin"}
              onClick={() => {
                setMode("superadmin");
                setError(null);
              }}
              className={`tap-target rounded-lg px-2 text-xs font-semibold transition-colors ${mode === "superadmin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              SuperAdmin
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-7 grid gap-5" noValidate>
            {isStaff ? (
              <div className="grid gap-2">
                <Label htmlFor="staff-email">Administrative email</Label>
                <Input
                  id="staff-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="tap-target rounded-xl"
                  placeholder="name@college.edu.ng"
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="matric">Matriculation number</Label>
                <Input
                  id="matric"
                  name="matric"
                  autoComplete="username"
                  inputMode="text"
                  required
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  className="tap-target rounded-xl"
                  placeholder="e.g. COH/2024/00123"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="tap-target rounded-xl"
              />
            </div>

            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              disabled={status !== "idle"}
              className="tap-target w-full rounded-xl font-semibold"
            >
              {status !== "idle" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Signing in…
                </>
              ) : (
                `Sign in as ${mode === "student" ? "Student" : mode === "admin" ? "Admin" : "SuperAdmin"}`
              )}
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground">
            {isStaff
              ? "Administrative access requires an active administrator account."
              : "Trouble signing in? Contact your exam officer."}
          </p>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Account access
              </span>
              <Separator className="flex-1" />
            </div>
          </div>
        </div>
      </section>
    </main>
    </SecureConnectionGate>
  );
}

function roleHome(role: Role) {
  if (role === "superadmin") return "/superadmin" as const;
  if (role === "admin") return "/admin" as const;
  return "/" as const;
}
