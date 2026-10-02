import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { readStaffSession } from "@/modules/auth/authorize";

export default async function DashboardOverviewPage() {
  const session = await readStaffSession();
  if (!session) redirect("/staff/login");
  const clinicId = session.staffUser.clinicId;

  // Sequential on purpose: local Prisma Postgres is single-connection and can
  // drop the connection under concurrent queries.
  const services = await prisma.service.count({
    where: { clinicId, active: true },
  });
  const providers = await prisma.provider.count({
    where: { clinicId, active: true },
  });
  const staff = await prisma.staffUser.count({
    where: { clinicId, active: true },
  });
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });

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
        <p className="mt-1 text-sm text-muted-foreground">
          {clinic?.timezone} Â· {clinic?.currency} Â· configuration milestone (M1)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50   "
          >
            <p className="text-3xl font-semibold">{card.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground   ">
        Booking, knowledge, and AI capabilities arrive in later milestones. See{" "}
        <span className="font-mono">PLAN.md</span> for the roadmap.
      </div>
    </div>
  );
}
