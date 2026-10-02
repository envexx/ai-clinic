import Link from "next/link";

const STEPS = [
  {
    title: "1. Ask about a service",
    body: "Open the chat, ask â€œWhat are your opening hours?â€ or â€œHow much is a dental cleaning?â€. The reply shows its sources.",
    href: "/chat",
    cta: "Open chat",
  },
  {
    title: "2. Book an appointment",
    body: "Pick a service and a free slot, add your details, review the summary and Confirm. A booking reference is shown.",
    href: "/book",
    cta: "Open booking",
  },
  {
    title: "3. See it on the visitor side",
    body: "The confirmed booking appears under My appointments for this browser session.",
    href: "/my-appointments",
    cta: "My appointments",
  },
  {
    title: "4. Contend for the same slot",
    body: "A second visitor trying the same slot gets a clear â€œslot unavailableâ€ instead of a duplicate booking.",
    href: "/book",
    cta: "Open booking",
  },
  {
    title: "5. Hand off to a human",
    body: "Say â€œI want to talk to staffâ€, then sign in as staff and claim the conversation in the inbox.",
    href: "/staff/login",
    cta: "Staff sign in",
  },
  {
    title: "6. Manage appointments as staff",
    body: "The appointments ledger lists real bookings and lets staff move status (check in, complete, cancel).",
    href: "/dashboard/appointments",
    cta: "Appointments",
  },
];

export default function DemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Portfolio demo â€” synthetic data only
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          AI Clinic Front Desk â€” guided scenario
        </h1>
        <p className="text-muted-foreground ">
          A five-minute walkthrough. All patient data is synthetic. No secrets
          are shown on this page.
        </p>
      </header>

      <section className="rounded-2xl border border-border p-6 ">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Staff demo accounts
        </h2>
        <ul className="mt-3 space-y-1 font-mono text-sm">
          <li>admin@wellnest.demo (ADMIN)</li>
          <li>frontdesk@wellnest.demo (RECEPTIONIST)</li>
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">
          Password: value of your local <span className="font-mono">SEED_STAFF_PASSWORD</span>{" "}
          (default <span className="font-mono">demo-password</span>).
        </p>
      </section>

      <ol className="flex flex-col gap-4">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className="rounded-2xl border border-border p-5 "
          >
            <h3 className="font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground ">
              {step.body}
            </p>
            <Link
              className="mt-3 inline-flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background   "
              href={step.href}
            >
              {step.cta}
            </Link>
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-border p-6 text-sm ">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Notes and limitations
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground ">
          <li>
            Without a <span className="font-mono">GEMINI_API_KEY</span>, the chat
            uses a deterministic fallback agent and embeddings use a lexical
            fallback.
          </li>
          <li>
            Local Prisma Postgres is single-connection; hosted Postgres is needed
            for the true concurrency gate.
          </li>
          <li>No WhatsApp/SMS integration is claimed in this version.</li>
        </ul>
      </section>
    </main>
  );
}
