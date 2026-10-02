"use client";

import { useEffect, useState } from "react";

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

type AppointmentRow = {
  id: string;
  bookingReference: string;
  serviceName: string;
  providerName: string;
  visitorName: string;
  contact: string;
  startAt: string;
  endAt: string;
  status: string;
  version: number;
  currency: string;
  priceMinor: number;
};

const STATUSES = [
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

function formatWhen(startAt: string, endAt: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startAt))} – ${timeFormatter.format(
    new Date(endAt),
  )}`;
}

export function AppointmentsManager() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status) params.set("status", status);
      const data = await apiRequest<AppointmentRow[]>(
        `/api/staff/appointments?${params.toString()}`,
      );
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiRequest<AppointmentRow[]>(
          "/api/staff/appointments",
        );
        if (active) setRows(data);
      } catch {
        // The Apply button surfaces errors explicitly.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function updateStatus(row: AppointmentRow, nextStatus: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/staff/appointments/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          expectedVersion: row.version,
        }),
      });
      setMessage(`${row.bookingReference} → ${nextStatus}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  function actionsFor(row: AppointmentRow) {
    if (row.status === "CONFIRMED") {
      return ["CHECKED_IN", "CANCELLED", "NO_SHOW"];
    }
    if (row.status === "CHECKED_IN") {
      return ["COMPLETED"];
    }
    return [];
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={cardClass}>
        <div className="flex flex-wrap items-end gap-2">
          <label className={labelClass}>
            From
            <input
              className={inputClass}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            To
            <input
              className={inputClass}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Status
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Any</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            className={primaryButtonClass}
            type="button"
            onClick={load}
            disabled={busy}
          >
            Apply
          </button>
        </div>
      </div>

      {error && <p className={errorClass}>{error}</p>}
      {message && <p className={successClass}>{message}</p>}

      <div className={cardClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Visitor</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border "
                  >
                    <td className="py-2 pr-4 font-mono">
                      {row.bookingReference}
                    </td>
                    <td className="py-2 pr-4">
                      {row.visitorName}
                      <span className="block text-xs text-muted-foreground">
                        {row.contact}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{row.serviceName}</td>
                    <td className="py-2 pr-4">{row.providerName}</td>
                    <td className="py-2 pr-4">
                      {formatWhen(row.startAt, row.endAt)}
                    </td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {actionsFor(row).map((next) => (
                          <button
                            key={next}
                            className={secondaryButtonClass}
                            type="button"
                            onClick={() => updateStatus(row, next)}
                            disabled={busy}
                          >
                            {next}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
