import Link from "next/link";

const endpoints = [
  { href: "/api/health", label: "GET /api/health" },
  { href: "/api/me", label: "GET /api/me" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          AI Clinic Front Desk
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          WellNest Clinic
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Administratif front desk for appointment booking and clinic questions.
          Currently at <strong>M0 — Foundation</strong>: sessions, database, and
          API groundwork.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          href="/book"
        >
          Book an appointment
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          href="/my-appointments"
        >
          My appointments
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          href="/staff/login"
        >
          Staff sign in
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Available endpoints
        </h2>
        <ul className="mt-4 flex flex-col gap-2 font-mono text-sm">
          {endpoints.map((endpoint) => (
            <li key={endpoint.href}>
              <Link
                className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                href={endpoint.href}
              >
                {endpoint.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-zinc-500">
        Visitor chat, booking, and the staff dashboard arrive in later milestones.
        See <span className="font-mono">PLAN.md</span>.
      </p>
    </main>
  );
}
