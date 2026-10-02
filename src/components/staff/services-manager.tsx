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

export type ServiceRow = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceMinor: number;
  active: boolean;
  providerIds: string[];
};

export type ProviderOption = {
  id: string;
  displayName: string;
  active: boolean;
};

type FormState = {
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceAed: string;
  providerIds: string[];
};

const emptyForm: FormState = {
  name: "",
  durationMinutes: 30,
  bufferMinutes: 0,
  priceAed: "0.00",
  providerIds: [],
};

function formatPrice(priceMinor: number, currency: string): string {
  return `${currency} ${(priceMinor / 100).toFixed(2)}`;
}

export function ServicesManager({
  services,
  providers,
  currency,
}: {
  services: ServiceRow[];
  providers: ProviderOption[];
  currency: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reset() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(service: ServiceRow) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
      priceAed: (service.priceMinor / 100).toFixed(2),
      providerIds: service.providerIds,
    });
    setError(null);
    setMessage(null);
  }

  function toggleProvider(providerId: string) {
    setForm((current) => ({
      ...current,
      providerIds: current.providerIds.includes(providerId)
        ? current.providerIds.filter((id) => id !== providerId)
        : [...current.providerIds, providerId],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: form.name,
        durationMinutes: Number(form.durationMinutes),
        bufferMinutes: Number(form.bufferMinutes),
        priceMinor: Math.round(Number(form.priceAed) * 100),
        providerIds: form.providerIds,
      };
      if (editingId) {
        await apiRequest(`/api/admin/services/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Service updated.");
      } else {
        await apiRequest("/api/admin/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Service created.");
      }
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save service");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(service: ServiceRow, active: boolean) {
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className={cardClass} onSubmit={submit}>
        <h2 className="text-lg font-semibold">
          {editingId ? "Edit service" : "New service"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Name
            <input
              className={inputClass}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Price ({currency})
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.01"
              required
              value={form.priceAed}
              onChange={(e) => setForm({ ...form, priceAed: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Duration (minutes, multiple of 15)
            <input
              className={inputClass}
              type="number"
              min="15"
              step="15"
              required
              value={form.durationMinutes}
              onChange={(e) =>
                setForm({ ...form, durationMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label className={labelClass}>
            Buffer after (minutes, multiple of 15)
            <input
              className={inputClass}
              type="number"
              min="0"
              step="15"
              required
              value={form.bufferMinutes}
              onChange={(e) =>
                setForm({ ...form, bufferMinutes: Number(e.target.value) })
              }
            />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted">
            Eligible providers
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {providers.map((provider) => (
              <label
                key={provider.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.providerIds.includes(provider.id)}
                  onChange={() => toggleProvider(provider.id)}
                />
                {provider.displayName}
              </label>
            ))}
            {providers.length === 0 && (
              <span className="text-sm text-muted">
                Add a provider first.
              </span>
            )}
          </div>
        </fieldset>

        {error && <p className={`mt-4 ${errorClass}`}>{error}</p>}
        {message && <p className={`mt-4 ${successClass}`}>{message}</p>}

        <div className="mt-4 flex gap-2">
          <button className={primaryButtonClass} disabled={busy} type="submit">
            {editingId ? "Save changes" : "Create service"}
          </button>
          {editingId && (
            <button
              className={secondaryButtonClass}
              type="button"
              onClick={reset}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className={cardClass}>
        <h2 className="text-lg font-semibold">Services</h2>
        {services.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No services yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Buffer</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Providers</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    className="border-t border-line "
                  >
                    <td className="py-2 pr-4 font-medium">{service.name}</td>
                    <td className="py-2 pr-4">{service.durationMinutes} min</td>
                    <td className="py-2 pr-4">{service.bufferMinutes} min</td>
                    <td className="py-2 pr-4">
                      {formatPrice(service.priceMinor, currency)}
                    </td>
                    <td className="py-2 pr-4">
                      {service.providerIds.length === 0
                        ? "â€”"
                        : service.providerIds
                            .map(
                              (id) =>
                                providers.find((p) => p.id === id)
                                  ?.displayName ?? id,
                            )
                            .join(", ")}
                    </td>
                    <td className="py-2 pr-4">
                      {service.active ? "Active" : "Inactive"}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          onClick={() => startEdit(service)}
                        >
                          Edit
                        </button>
                        <button
                          className={secondaryButtonClass}
                          type="button"
                          onClick={() => setActive(service, !service.active)}
                        >
                          {service.active ? "Deactivate" : "Activate"}
                        </button>
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
