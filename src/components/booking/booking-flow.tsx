"use client";

import Link from "next/link";
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

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMinor: number;
  currency: string;
};

type Slot = {
  providerId: string;
  providerName: string;
  serviceId: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  occupiedEnd: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  timezone: string;
};

type PreparedAction = {
  actionId: string;
  expiresAt: string;
  summary: {
    serviceName: string;
    providerName: string;
    startAt: string;
    endAt: string;
    displayName: string;
    priceMinor: number;
    currency: string;
    timezone: string;
  };
};

type AppointmentSummary = {
  id: string;
  bookingReference: string;
  serviceName: string;
  providerName: string;
  startAt: string;
  endAt: string;
  status: string;
  currency: string;
  priceMinor: number;
};

function todayPlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function formatRange(startAt: string, endAt: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(startAt))} – ${timeFormatter.format(
    new Date(endAt),
  )} (${timezone})`;
}

export function BookingFlow() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayPlus(1));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    contact: "",
    consent: false,
  });
  const [prepared, setPrepared] = useState<PreparedAction | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [confirmed, setConfirmed] = useState<AppointmentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ServiceOption[]>("/api/services")
      .then((data) => {
        setServices(data);
        if (data.length > 0) setServiceId((current) => current || data[0].id);
      })
      .catch(() => setError("Could not load services"));
  }, []);

  async function loadSlots() {
    if (!serviceId) return;
    setLoadingSlots(true);
    setError(null);
    setSelected(null);
    setPrepared(null);
    setConfirmed(null);
    try {
      const data = await apiRequest<Slot[]>(
        `/api/availability?serviceId=${serviceId}&from=${date}&to=${date}`,
      );
      setSlots(data);
      if (data.length === 0) {
        setError("No free slots on that day. Try another date.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slots");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/guest-session", { method: "POST" });
      const data = await apiRequest<PreparedAction>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceId: selected.serviceId,
          providerId: selected.providerId,
          startAt: selected.startAt,
          displayName: form.displayName,
          contact: form.contact,
          consent: true,
        }),
      });
      setPrepared(data);
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare booking");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<AppointmentSummary>(
        `/api/actions/${prepared.actionId}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ idempotencyKey }),
        },
      );
      setConfirmed(data);
      setPrepared(null);
      setSelected(null);
      setSlots([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm booking");
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) {
    return (
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
          Booking confirmed
        </h2>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Reference</dt>
            <dd data-testid="booking-reference" className="font-mono font-semibold">
              {confirmed.bookingReference}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Service</dt>
            <dd>{confirmed.serviceName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Provider</dt>
            <dd>{confirmed.providerName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">When</dt>
            <dd>{formatRange(confirmed.startAt, confirmed.endAt, "Asia/Dubai")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Price</dt>
            <dd>{money(confirmed.priceMinor, confirmed.currency)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex gap-2">
          <Link className={primaryButtonClass} href="/my-appointments">
            View my appointments
          </Link>
          <button
            className={secondaryButtonClass}
            type="button"
            onClick={() => {
              setConfirmed(null);
              setForm({ displayName: "", contact: "", consent: false });
            }}
          >
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={cardClass}>
        <h2 className="text-lg font-semibold">1. Choose a service and day</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            Service
            <select
              className={inputClass}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.durationMinutes} min)
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Date
            <input
              className={inputClass}
              type="date"
              value={date}
              min={todayPlus(0)}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              className={primaryButtonClass}
              type="button"
              onClick={loadSlots}
              disabled={loadingSlots || !serviceId}
            >
              {loadingSlots ? "Checking…" : "Check availability"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className={errorClass}>{error}</p>}

      {slots.length > 0 && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold">2. Pick a slot</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {slots.map((slot) => (
              <li key={`${slot.providerId}-${slot.startAt}`}>
                <button
                  type="button"
                  data-testid="slot-option"
                  onClick={() => setSelected(slot)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selected?.startAt === slot.startAt &&
                    selected?.providerId === slot.providerId
                      ? "border-primary bg-background  "
                      : "border-border hover:border-primary/50 "
                  }`}
                >
                  <span className="font-medium">
                    {formatRange(slot.startAt, slot.endAt, slot.timezone)}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {slot.providerName} · {money(slot.priceMinor, slot.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && !prepared && (
        <form className={cardClass} onSubmit={prepare}>
          <h2 className="text-lg font-semibold">3. Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Full name
              <input
                className={inputClass}
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </label>
            <label className={labelClass}>
              Phone or email
              <input
                className={inputClass}
                required
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </label>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.consent}
              onChange={(e) => setForm({ ...form, consent: e.target.checked })}
            />
            <span>
              I agree that WellNest Clinic may use these contact details to manage
              this appointment. This demo uses synthetic data.
            </span>
          </label>
          <div className="mt-4">
            <button
              className={primaryButtonClass}
              disabled={busy || !form.consent}
              type="submit"
            >
              {busy ? "Preparing…" : "Review booking"}
            </button>
          </div>
        </form>
      )}

      {prepared && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold">4. Confirm your booking</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing is saved until you confirm. This offer expires at{" "}
            {new Date(prepared.expiresAt).toLocaleTimeString()}.
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Service</dt>
              <dd>{prepared.summary.serviceName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider</dt>
              <dd>{prepared.summary.providerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">When</dt>
              <dd>
                {formatRange(
                  prepared.summary.startAt,
                  prepared.summary.endAt,
                  prepared.summary.timezone,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{prepared.summary.displayName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Price</dt>
              <dd>
                {money(prepared.summary.priceMinor, prepared.summary.currency)}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-2">
            <button
              className={primaryButtonClass}
              type="button"
              onClick={confirm}
              disabled={busy}
            >
              {busy ? "Confirming…" : "Confirm booking"}
            </button>
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={() => setPrepared(null)}
              disabled={busy}
            >
              Change
            </button>
          </div>
        </div>
      )}

      {confirmed && <p className={successClass}>Booking confirmed.</p>}
    </div>
  );
}
