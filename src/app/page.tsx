import Link from "next/link";
import {
  CalendarCheck,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/db";
import { WEEKDAY_LABELS } from "@/lib/weekdays";

export const dynamic = "force-dynamic";

function money(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

const CAPABILITIES = [
  {
    icon: MessageSquareText,
    title: "Answers that cite their source",
    body: "Questions about services, prices and policies are answered only from approved clinic knowledge — and it abstains when nothing matches.",
  },
  {
    icon: CalendarCheck,
    title: "Bookings that cannot double-book",
    body: "Availability is computed from real working hours and time off. A database constraint guarantees one appointment per provider slot.",
  },
  {
    icon: Users,
    title: "A human in the loop",
    body: "Guests can hand off to staff at any time. Staff claim the conversation, reply, and keep private notes the visitor never sees.",
  },
];

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
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" strokeWidth={2} />
          </span>
          WellNest
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/book"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Book
          </Link>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/staff/login" />}
          >
            Staff sign in
          </Button>
        </nav>
      </header>

      <Separator />

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            The front desk that never puts you on hold.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            WellNest Clinic answers administrative questions, finds real
            appointment slots and books them — with grounded knowledge, safe
            transactions and a human always one tap away.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/chat" />}>
              Chat with the front desk
            </Button>
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/book" />}
            >
              Book an appointment
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <MapPin className="size-4" strokeWidth={1.75} />
              {clinic?.address ?? "Jumeirah Beach Road, Dubai, UAE"}
            </span>
            <span className="flex items-center gap-2">
              <Phone className="size-4" strokeWidth={1.75} />
              {clinic?.phone ?? "+971 4 555 0134"}
            </span>
            <span className="flex items-center gap-2">
              <Mail className="size-4" strokeWidth={1.75} />
              {clinic?.email ?? "hello@wellnest.ae"}
            </span>
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Built for a calm, correct front desk
            </h2>
            <ul className="mt-8 flex flex-col gap-7">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-4">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4.5" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="p-6">
              <h3 className="text-sm font-semibold">Open this week</h3>
              <p className="text-xs text-muted-foreground">Times in {timezone}.</p>
              <dl className="mt-4 flex flex-col gap-1.5 text-sm">
                {hours.length === 0 && (
                  <p className="text-muted-foreground">
                    Hours are being configured.
                  </p>
                )}
                {hours.map((hour, index) => (
                  <div
                    key={`${hour.weekday}-${index}`}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="text-muted-foreground">
                      {WEEKDAY_LABELS[hour.weekday]}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {hour.localStart}–{hour.localEnd}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <Separator />
            <div className="p-6">
              <h3 className="text-sm font-semibold">Services</h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {services.length === 0 && (
                  <li className="text-muted-foreground">
                    Services are being configured.
                  </li>
                )}
                {services.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span>
                      {service.name}
                      <span className="ml-2 text-xs text-muted-foreground">
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
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground">
          <p>{clinic?.address ?? "Jumeirah Beach Road, Dubai, UAE"}</p>
          <div className="flex gap-4">
            <Link className="hover:text-foreground" href="/my-appointments">
              My appointments
            </Link>
            <Link className="hover:text-foreground" href="/staff/login">
              Staff sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
