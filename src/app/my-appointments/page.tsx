import Link from "next/link";

import { listVisitorAppointments } from "@/modules/appointments/appointments";
import { readGuestSession } from "@/modules/auth/authorize";

function formatRange(startAt: string, endAt: string): string {
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

export default async function MyAppointmentsPage() {
  const session = await readGuestSession();
  const appointments = session
    ? await listVisitorAppointments({
        id: session.id,
        clinicId: session.clinicId,
      })
    : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          My appointments
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Appointments are linked to this browser session. On another device,
          please contact the clinic.
        </p>
      </header>

      {appointments.length === 0 ? (
        <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground ">
          No appointments yet.{" "}
          <Link
            className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
            href="/book"
          >
            Book one
          </Link>
          .
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="rounded-2xl border border-border p-4 "
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold">
                  {appointment.bookingReference}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {appointment.status}
                </span>
              </div>
              <p className="mt-1 text-sm">
                {appointment.serviceName} with {appointment.providerName}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatRange(appointment.startAt, appointment.endAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
