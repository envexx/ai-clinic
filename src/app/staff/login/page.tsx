"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  cardClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/client-api";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@wellnest.demo");
  const [password, setPassword] = useState("demo-password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/staff/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted">
          WellNest Clinic dashboard access.
        </p>
      </div>

      <form className={cardClass} onSubmit={submit}>
        <label className={labelClass}>
          Email
          <input
            className={inputClass}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={`${labelClass} mt-4`}>
          Password
          <input
            className={inputClass}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className={`mt-4 ${errorClass}`}>{error}</p>}

        <button className={`mt-4 w-full ${primaryButtonClass}`} disabled={busy} type="submit">
          {busy ? "Signing inâ€¦" : "Sign in"}
        </button>
      </form>

      <p className="text-xs text-muted">
        Demo accounts: admin@wellnest.demo / frontdesk@wellnest.demo â€” password
        from <span className="font-mono">SEED_STAFF_PASSWORD</span>.
      </p>
    </main>
  );
}
