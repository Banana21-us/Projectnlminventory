"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/use-user";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/guesthouse", label: "Today", exact: true },
  { href: "/guesthouse/bookings", label: "Bookings" },
  { href: "/guesthouse/rooms", label: "Rooms", permission: "guesthouse.rooms" as const },
  { href: "/guesthouse/guests", label: "Guests" },
  { href: "/guesthouse/accounting", label: "Accounting", permission: "guesthouse.accounting" as const },
];

/** Section tabs for the guesthouse module — the main nav stays flat, so
 *  this is where Today/Bookings/Rooms/Guests/Accounting live. Rooms and
 *  Accounting only render for roles that can see them. */
export function GuesthouseTabs() {
  const pathname = usePathname();
  const { can } = useCurrentUser();

  return (
    <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1">
      {TABS.filter((t) => !t.permission || can(t.permission)).map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand text-white" : "text-ink-soft hover:bg-line/50",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
