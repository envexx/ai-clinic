"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  cardClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/client-api";

export type ProviderRow = {
  id: string;
  displayName: string;
  active: boolean;
};

export function ProvidersManager({ providers }: { providers: ProviderRow[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest("/api/admin/providers", {
        method: "POST",
        body: JSON.stringify({ displayName }),
      });
      setDisplayName("");
      setMessage("Provider created.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create provider");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(provider: ProviderRow) {
    setError(null);
    try {
      await apiRequest(`/api/admin/providers/${provider.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !provider.active }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update provider");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className={cardClass} onSubmit={submit}>
        <h2 className="text-lg font-semibold">New provider</h2>
        <label className={`${labelClass} mt-3 max-w-sm`}>
          Display name
          <input
            className={inputClass}
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        {error && <p className={`mt-4 ${errorClass}`}>{error}</p>}
        {message && <p className={`mt-4 ${successClass}`}>{message}</p>}
        <div className="mt-4">
          <button className={primaryButtonClass} disabled={busy} type="submit">
            Create provider
          </button>
        </div>
      </form>

      <div className={cardClass}>
        <h2 className="text-lg font-semibold">Providers</h2>
        {providers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No providers yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {providers.map((provider) => (
              <li
                key={provider.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 "
              >
                <span className="text-sm font-medium">
                  {provider.displayName}{" "}
                  <span className="text-muted-foreground">
                    ({provider.active ? "Active" : "Inactive"})
                  </span>
                </span>
                <button
                  className={secondaryButtonClass}
                  type="button"
                  onClick={() => toggle(provider)}
                >
                  {provider.active ? "Deactivate" : "Activate"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
