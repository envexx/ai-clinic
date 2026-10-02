import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireStaff } from "@/modules/auth/authorize";

export default async function DashboardOverviewPage() {
  const { staffUser } = await requireStaff();
  const clinicId = staffUser.clinicId;

  const [services, providers, staff, clinic] = await Promise.all([
    prisma.service.count({ where: { clinicId, active: true } }),
    prisma.provider.count({ where: { clinicId, active: true } }),
    prisma.staffUser.count({ where: { clinicId, active: true } }),
    prisma.clinic.findUnique({ where: { id: clinicId } }),
  ]);

  const cards = [
    { label: "Active services", value: services, href: "/dashboard/services" },
    { label: "Active providers", value: providers, href: "/dashboard/providers" },
    { label: "Staff accounts", value: staff, href: "/dashboard/settings" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {clinic?.name ?? "Clinic"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {clinic?.timezone} · {clinic?.currency} · configuration milestone (M1)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <p className="text-3xl font-semibold">{card.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Booking, knowledge, and AI capabilities arrive in later milestones. See{" "}
        <span className="font-mono">PLAN.md</span> for the roadmap.
      </div>
    </div>
  );
}
