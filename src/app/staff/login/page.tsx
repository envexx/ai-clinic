"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "demo-password";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@wellnest.demo" },
  { label: "Receptionist", email: "frontdesk@wellnest.demo" },
] as const;

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(nextEmail: string, nextPassword: string) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/staff/login", {
        method: "POST",
        body: JSON.stringify({ email: nextEmail, password: nextPassword }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void signIn(email, password);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" strokeWidth={2} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            Sign in to WellNest
          </h1>
          <p className="text-sm text-muted-foreground">
            Staff dashboard access.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">
            Accounts — pick one to fill the form
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => {
              const selected = email === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                    setError(null);
                  }}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  <span className="font-medium">{account.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {account.email}
                  </span>
                </button>
              );
            })}
          </div>

          <Separator className="my-5" />

          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <div className="mt-5 flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <p>
            Credentials are pre-filled for local sign-in. Set
            <span className="font-mono"> SEED_STAFF_PASSWORD</span> to change
            them.
          </p>
          <Link
            href="/"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to clinic
          </Link>
        </div>
      </div>
    </main>
  );
}
