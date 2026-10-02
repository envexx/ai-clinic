"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  cardClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  successClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/client-api";

export type ClinicSettings = {
  name: string;
  timezone: string;
  currency: string;
  slotGranularityMinutes: number;
  bookingHorizonDays: number;
  minimumNoticeMinutes: number;
  selfServiceCutoffMinutes: number;
  pendingActionTtlMinutes: number;
};

export function SettingsForm({ clinic }: { clinic: ClinicSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<ClinicSettings>(clinic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setMessage("Settings saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={cardClass} onSubmit={submit}>
      <h2 className="text-lg font-semibold">Clinic settings</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Clinic name
          <input
            className={inputClass}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className={labelClass}>
          Timezone (IANA)
          <input
            className={inputClass}
            required
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </label>
        <label className={labelClass}>
          Currency (3 letters)
          <input
            className={inputClass}
            required
            maxLength={3}
            value={form.currency}
            onChange={(e) =>
              setForm({ ...form, currency: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label className={labelClass}>
          Slot granularity (minutes)
          <input
            className={inputClass}
            type="number"
            min="5"
            step="5"
            required
            value={form.slotGranularityMinutes}
            onChange={(e) =>
              setForm({ ...form, slotGranularityMinutes: Number(e.target.value) })
            }
          />
        </label>
        <label className={labelClass}>
          Booking horizon (days)
          <input
            className={inputClass}
            type="number"
            min="1"
            required
            value={form.bookingHorizonDays}
            onChange={(e) =>
              setForm({ ...form, bookingHorizonDays: Number(e.target.value) })
            }
          />
        </label>
        <label className={labelClass}>
          Minimum notice (minutes)
          <input
            className={inputClass}
            type="number"
            min="0"
            required
            value={form.minimumNoticeMinutes}
            onChange={(e) =>
              setForm({ ...form, minimumNoticeMinutes: Number(e.target.value) })
            }
          />
        </label>
        <label className={labelClass}>
          Self-service cutoff (minutes before start)
          <input
            className={inputClass}
            type="number"
            min="0"
            required
            value={form.selfServiceCutoffMinutes}
            onChange={(e) =>
              setForm({
                ...form,
                selfServiceCutoffMinutes: Number(e.target.value),
              })
            }
          />
        </label>
        <label className={labelClass}>
          Pending action TTL (minutes)
          <input
            className={inputClass}
            type="number"
            min="1"
            required
            value={form.pendingActionTtlMinutes}
            onChange={(e) =>
              setForm({
                ...form,
                pendingActionTtlMinutes: Number(e.target.value),
              })
            }
          />
        </label>
      </div>

      {error && <p className={`mt-4 ${errorClass}`}>{error}</p>}
      {message && <p className={`mt-4 ${successClass}`}>{message}</p>}

      <div className="mt-4">
        <button className={primaryButtonClass} disabled={busy} type="submit">
          Save settings
        </button>
      </div>
    </form>
  );
}
