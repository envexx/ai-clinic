import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/staff/dashboard-nav";
import { LogoutButton } from "@/components/staff/logout-button";
import { readStaffSession } from "@/modules/auth/authorize";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await readStaffSession();
  if (!session) {
    redirect("/staff/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-8 px-6 py-10 lg:flex-row">
      <aside className="flex flex-col gap-6 lg:w-60 lg:shrink-0">
        <div>
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            WellNest
          </Link>
          <p className="mt-2 text-sm font-medium text-foreground">
            {session.staffUser.email}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {session.staffUser.role}
          </p>
        </div>

        <DashboardNav />

        <LogoutButton />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
