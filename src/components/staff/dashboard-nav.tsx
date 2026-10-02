"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CalendarClock,
  Inbox,
  LayoutDashboard,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/dashboard/services", label: "Services", icon: Sparkles },
  { href: "/dashboard/providers", label: "Providers", icon: UserRound },
  { href: "/dashboard/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
      {NAV.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
