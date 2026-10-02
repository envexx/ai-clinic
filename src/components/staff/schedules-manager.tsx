"use client";

import { useState } from "react";

import {
  cardClass,
  dangerButtonClass,
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  successClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/client-api";
import { WEEKDAY_LABELS, WEEKDAY_OPTIONS } from "@/lib/weekdays";

export type HourRow = {
  weekday: number;
  localStart: string;
  localEnd: string;
};

export type ExceptionRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

type ProviderOption = { id: string; displayName: string };

type InitialSchedule = {
  providerId: string;
  workingHours: HourRow[];
  exceptions: ExceptionRow[];
};

function HoursEditor({
  hours,
  onChange,
  emptyLabel,
}: {
  hours: HourRow[];
  onChange: (hours: HourRow[]) => void;
  emptyLabel: string;
}) {
  function update(index: number, patch: Partial<HourRow>) {
    onChange(hours.map((hour, i) => (i === index ? { ...hour, ...patch } : hour)));
  }

  return (
    <div className="flex flex-col gap-2">
      {hours.length === 0 && (
        <p className="text-sm text-zinc-500">{emptyLabel}</p>
      )}
      {hours.map((hour, index) => (
        <div key={index} className="flex flex-wrap items-end gap-2">
          <label className={labelClass}>
            Day
            <select
              className={inputClass}
              value={hour.weekday}
              onChange={(e) => update(index, { weekday: Number(e.target.value) })}
            >
              {WEEKDAY_OPTIONS.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {WEEKDAY_LABELS[weekday]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Start
            <input
              className={inputClass}
              type="time"
              value={hour.localStart}
              onChange={(e) => update(index, { localStart: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            End
            <input
              className={inputClass}
              type="time"
              value={hour.localEnd}
              onChange={(e) => update(index, { localEnd: e.target.value })}
            />
          </label>
          <button
            className={dangerButtonClass}
            type="button"
            onClick={() => onChange(hours.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <div>
        <button
          className={secondaryButtonClass}
          type="button"
          onClick={() =>
            onChange([
              ...hours,
              { weekday: 1, localStart: "09:00", localEnd: "17:00" },
            ])
          }
        >
          Add block
        </button>
      </div>
    </div>
  );
}

export function SchedulesManager({
  providers,
  clinicHours: initialClinicHours,
  initialSchedule,
}: {
  providers: ProviderOption[];
  clinicHours: HourRow[];
  initialSchedule: InitialSchedule | null;
}) {
  const [providerId, setProviderId] = useState(initialSchedule?.providerId ?? "");
  const [workingHours, setWorkingHours] = useState<HourRow[]>(
    initialSchedule?.workingHours ?? [],
  );
  const [exceptions, setExceptions] = useState<ExceptionRow[]>(
    initialSchedule?.exceptions ?? [],
  );
  const [clinicHours, setClinicHours] = useState<HourRow[]>(initialClinicHours);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [exceptionForm, setExceptionForm] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
  });

  async function loadSchedule(id: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        workingHours: HourRow[];
        exceptions: ExceptionRow[];
      }>(`/api/admin/schedules/${id}`);
      setWorkingHours(data.workingHours);
      setExceptions(data.exceptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }

  function onProviderChange(id: string) {
    setProviderId(id);
    void loadSchedule(id);
  }

  async function saveWorkingHours() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const hours = await apiRequest<HourRow[]>(
        `/api/admin/schedules/${providerId}`,
        { method: "PUT", body: JSON.stringify({ hours: workingHours }) },
      );
      setWorkingHours(hours);
      setMessage("Working hours saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function saveClinicHours() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const hours = await apiRequest<HourRow[]>("/api/admin/clinic-hours", {
        method: "PUT",
        body: JSON.stringify({ hours: clinicHours }),
      });
      setClinicHours(hours);
      setMessage("Clinic hours saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function addException(event: React.FormEvent) {
    event.preventDefault();
    if (!providerId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiRequest<ExceptionRow>(
        "/api/admin/schedule-exceptions",
        {
          method: "POST",
          body: JSON.stringify({
            providerId,
            startsAt: new Date(exceptionForm.startsAt).toISOString(),
            endsAt: new Date(exceptionForm.endsAt).toISOString(),
            reason: exceptionForm.reason,
          }),
        },
      );
      setExceptions((current) =>
        [...current, created].sort((a, b) =>
          a.startsAt.localeCompare(b.startsAt),
        ),
      );
      setExceptionForm({ startsAt: "", endsAt: "", reason: "" });
      setMessage("Time off added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add time off");
    } finally {
      setBusy(false);
    }
  }

  async function removeException(id: string) {
    setError(null);
    try {
      await apiRequest(`/api/admin/schedule-exceptions/${id}`, {
        method: "DELETE",
      });
      setExceptions((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className={errorClass}>{error}</p>}
      {message && <p className={successClass}>{message}</p>}

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Clinic opening hours</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Provider hours must fit inside these blocks.
        </p>
        <div className="mt-4">
          <HoursEditor
            hours={clinicHours}
            onChange={setClinicHours}
            emptyLabel="No clinic hours configured."
          />
        </div>
        <div className="mt-4">
          <button
            className={primaryButtonClass}
            type="button"
            disabled={busy}
            onClick={saveClinicHours}
          >
            Save clinic hours
          </button>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-semibold">Provider schedule</h2>
        <label className={`${labelClass} mt-3 max-w-xs`}>
          Provider
          <select
            className={inputClass}
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName}
              </option>
            ))}
          </select>
        </label>

        {providers.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Add a provider before configuring hours.
          </p>
        ) : loading ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : (
          <>
            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Weekly working hours
            </h3>
            <div className="mt-2">
              <HoursEditor
                hours={workingHours}
                onChange={setWorkingHours}
                emptyLabel="No working hours configured."
              />
            </div>
            <div className="mt-4">
              <button
                className={primaryButtonClass}
                type="button"
                disabled={busy}
                onClick={saveWorkingHours}
              >
                Save working hours
              </button>
            </div>

            <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Time off
            </h3>
            {exceptions.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No time off.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                {exceptions.map((exception) => (
                  <li
                    key={exception.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                  >
                    <span>
                      {new Date(exception.startsAt).toLocaleString()} —{" "}
                      {new Date(exception.endsAt).toLocaleString()} ·{" "}
                      <span className="text-zinc-500">{exception.reason}</span>
                    </span>
                    <button
                      className={dangerButtonClass}
                      type="button"
                      onClick={() => removeException(exception.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="mt-4 flex flex-wrap items-end gap-2"
              onSubmit={addException}
            >
              <label className={labelClass}>
                Starts
                <input
                  className={inputClass}
                  type="datetime-local"
                  required
                  value={exceptionForm.startsAt}
                  onChange={(e) =>
                    setExceptionForm({
                      ...exceptionForm,
                      startsAt: e.target.value,
                    })
                  }
                />
              </label>
              <label className={labelClass}>
                Ends
                <input
                  className={inputClass}
                  type="datetime-local"
                  required
                  value={exceptionForm.endsAt}
                  onChange={(e) =>
                    setExceptionForm({ ...exceptionForm, endsAt: e.target.value })
                  }
                />
              </label>
              <label className={labelClass}>
                Reason
                <input
                  className={inputClass}
                  required
                  value={exceptionForm.reason}
                  onChange={(e) =>
                    setExceptionForm({ ...exceptionForm, reason: e.target.value })
                  }
                />
              </label>
              <button className={secondaryButtonClass} disabled={busy} type="submit">
                Add time off
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
