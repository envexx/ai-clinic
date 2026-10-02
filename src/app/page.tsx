import Link from "next/link";

import { prisma } from "@/lib/db";
import { WEEKDAY_LABELS } from "@/lib/weekdays";

export const dynamic = "force-dynamic";

function money(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default async function Home() {
  const clinic = await prisma.clinic.findFirst({ orderBy: { createdAt: "asc" } });
  const services = clinic
    ? await prisma.service.findMany({
        where: { clinicId: clinic.id, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, durationMinutes: true, priceMinor: true },
      })
    : [];
  const hours = clinic
    ? await prisma.clinicHour.findMany({
        where: { clinicId: clinic.id },
        orderBy: [{ weekday: "asc" }, { localStart: "asc" }],
      })
    : [];

  const currency = clinic?.currency ?? "AED";
  const timezone = clinic?.timezone ?? "Asia/Dubai";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16 sm:py-24">
      <section className="flex flex-col gap-7">
        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Care that starts before you arrive.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted">
          WellNest Clinic&apos;s front desk answers your questions about
          services, prices and policies, then books your appointment — without
          making you wait on hold.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
          >
            Chat with the front desk
          </Link>
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:bg-paper"
          >
            Book an appointment
          </Link>
          <Link
            href="/demo"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            See the guided demo
          </Link>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        <div className="bg-surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Open this week</h2>
          <p className="mt-1 text-sm text-muted">All times in {timezone}.</p>
          <dl className="mt-5 flex flex-col gap-2 text-sm">
            {hours.length === 0 && (
              <p className="text-muted">Hours are being configured.</p>
            )}
            {hours.map((hour, index) => (
              <div
                key={`${hour.weekday}-${index}`}
                className="flex items-baseline justify-between gap-4 border-b border-line pb-2 last:border-b-0"
              >
                <dt className="text-muted">{WEEKDAY_LABELS[hour.weekday]}</dt>
                <dd className="font-medium tabular-nums">
                  {hour.localStart}–{hour.localEnd}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Services</h2>
          <p className="mt-1 text-sm text-muted">
            Fixed duration and price, shown when you book.
          </p>
          <ul className="mt-5 flex flex-col gap-3 text-sm">
            {services.length === 0 && (
              <li className="text-muted">Services are being configured.</li>
            )}
            {services.map((service) => (
              <li
                key={service.id}
                className="flex items-baseline justify-between gap-4"
              >
                <span>
                  {service.name}
                  <span className="ml-2 text-xs text-muted">
                    {service.durationMinutes} min
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {money(service.priceMinor, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm text-muted">
        <p>
          Open Monday to Saturday. This is a portfolio demo using synthetic data
          only.
        </p>
        <div className="flex gap-4">
          <Link className="hover:text-ink" href="/my-appointments">
            My appointments
          </Link>
          <Link className="hover:text-ink" href="/staff/login">
            Staff sign in
          </Link>
        </div>
      </footer>
    </main>
  );
}
