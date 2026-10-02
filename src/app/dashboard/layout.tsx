import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/staff/logout-button";
import { readStaffSession } from "@/modules/auth/authorize";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/providers", label: "Providers" },
  { href: "/dashboard/schedules", label: "Schedules" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await readStaffSession();
  if (!session) {
    redirect("/staff/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10 lg:flex-row">
      <aside className="flex flex-col gap-6 lg:w-56 lg:shrink-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            WellNest Clinic
          </p>
          <p className="mt-1 text-sm font-semibold">
            {session.staffUser.email}
          </p>
          <p className="text-xs text-zinc-500">{session.staffUser.role}</p>
        </div>

        <nav className="flex flex-row flex-wrap gap-2 lg:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <LogoutButton />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
