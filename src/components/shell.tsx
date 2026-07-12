"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BedDouble,
  House,
  Loader,
  Package,
  ScrollText,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof House;
}

// These sit below a separator at the bottom of the sidebar — audit/admin/
// account links rather than day-to-day work sections.
const SECONDARY_HREFS = new Set(["/log", "/admin", "/profile"]);

// Fixed slot count for the mobile bottom tab bar, regardless of how many
// tabs a role actually has — keeps icon size/spacing consistent and the
// raised Dispense button in the same visual position across roles (e.g.
// ADMIN's 5 tabs vs STAFF's 4) instead of drifting off-center.
const MOBILE_TAB_SLOTS = 5;

// Each role gets its own sidebar — the proxy enforces the same map
// server-side (src/lib/route-guards.ts), this is only presentation.
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/dashboard", label: "Home", icon: House },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/dispense", label: "Dispense", icon: Send },
    { href: "/log", label: "Log", icon: ScrollText },
    { href: "/admin", label: "Admin", icon: ShieldCheck },
    { href: "/guesthouse", label: "Guesthouse", icon: BedDouble },
    { href: "/profile", label: "Profile", icon: User },
  ],
  STAFF: [
    { href: "/dashboard", label: "Home", icon: House },
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/dispense", label: "Dispense", icon: Send },
    { href: "/log", label: "Log", icon: ScrollText },
    { href: "/profile", label: "Profile", icon: User },
  ],
  GUESTHOUSE: [
    { href: "/guesthouse", label: "Guesthouse", icon: BedDouble },
    { href: "/profile", label: "Profile", icon: User },
  ],
};

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center justify-center gap-3 rounded-lg transition-colors sm:w-11 lg:w-auto lg:justify-start lg:px-3",
        active ? "bg-brand-tint text-brand-dark" : "text-ink-soft hover:bg-bg hover:text-ink",
      )}
      title={label}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-brand" : "text-ink-faint")} />
      <span className="hidden text-sm font-medium lg:inline">{label}</span>
      {active && (
        <span className="absolute inset-y-2 left-0 hidden w-1 rounded-full bg-brand lg:block" />
      )}
    </Link>
  );
}

function Wordmark({ iconOnly }: { iconOnly?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        <Image
          src="/logo-churches.png"
          alt="Seventh-day Adventist Church logo"
          fill
          sizes="36px"
          className="object-contain p-1"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </span>
      {!iconOnly && (
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight text-ink">
            Northern Luzon Mission
          </span>
          <span className="block text-[11px] font-medium text-ink-faint">
            Inventory &amp; dispensing
          </span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, data: session } = useSession();
  const role = (session?.user?.role ?? "STAFF") as Role;
  const nav = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.STAFF;
  const primaryNav = nav.filter((item) => !SECONDARY_HREFS.has(item.href));
  const secondaryNav = nav.filter((item) => SECONDARY_HREFS.has(item.href));
  const hasGuesthouse = nav.some((item) => item.href === "/guesthouse");
  // Profile and Guesthouse live in the mobile header instead, so they don't
  // eat two of the bottom tab bar's 5 slots (Guesthouse was previously
  // getting silently cut off there for ADMIN, who has 6 non-profile items).
  const tabItems = nav
    .filter((item) => item.href !== "/profile" && item.href !== "/guesthouse")
    .slice(0, MOBILE_TAB_SLOTS);

  useEffect(() => {
    if (status === "unauthenticated" && !pathname.startsWith("/login")) {
      router.push("/login");
    }
  }, [status, pathname, router]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {/* Tablet icon rail / desktop labeled sidebar */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col items-center gap-8 bg-surface py-6 shadow-[1px_0_0_rgba(0,0,0,0.06)] sm:flex sm:w-[76px] lg:w-60 lg:items-stretch lg:px-4">
        <div className="lg:px-1">
          <span className="lg:hidden">
            <Wordmark iconOnly />
          </span>
          <span className="hidden lg:block">
            <Wordmark />
          </span>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 lg:items-stretch">
          {primaryNav.map((item) => (
            <SidebarLink key={item.href} {...item} active={pathname === item.href} />
          ))}

          {secondaryNav.length > 0 && (
            <div className="mt-auto flex flex-col items-center gap-1 lg:items-stretch">
              <div className="my-2 h-px w-8 self-center bg-line-strong/60 lg:w-full" />
              {secondaryNav.map((item) => (
                <SidebarLink key={item.href} {...item} active={pathname === item.href} />
              ))}
            </div>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-surface/90 px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
          <Wordmark />
          <div className="flex shrink-0 items-center gap-1.5">
            {hasGuesthouse && (
              <Link
                href="/guesthouse"
                aria-label="Guesthouse"
                aria-current={pathname === "/guesthouse" ? "page" : undefined}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  pathname === "/guesthouse"
                    ? "bg-brand-tint text-brand-dark"
                    : "text-ink-faint hover:bg-bg hover:text-ink",
                )}
              >
                <BedDouble className="h-5 w-5" />
              </Link>
            )}
            <Link
              href="/profile"
              aria-label="Profile"
              aria-current={pathname === "/profile" ? "page" : undefined}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                pathname === "/profile"
                  ? "bg-brand-tint text-brand-dark"
                  : "text-ink-faint hover:bg-bg hover:text-ink",
              )}
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-6xl flex-1 px-4 pt-5 sm:px-6 sm:pb-10 sm:pt-8",
            tabItems.length > 0 ? "pb-28" : "pb-5",
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar with raised dispense action — Profile and
          Guesthouse live in the mobile header instead, so they don't eat
          two of these 5 slots. */}
      {tabItems.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
          <div
            className="mx-auto grid max-w-md"
            style={{ gridTemplateColumns: `repeat(${MOBILE_TAB_SLOTS}, 1fr)` }}
          >
            {tabItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              const raised = href === "/dispense";
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5"
                >
                  <span
                    className={cn(
                      "flex items-center justify-center transition-colors",
                      raised
                        ? "-mt-6 h-13 w-13 rounded-full bg-ember text-white shadow-lg shadow-ember/30 ring-4 ring-bg"
                        : cn("h-7 w-7", active ? "text-brand-dark" : "text-ink-faint"),
                    )}
                  >
                    <Icon className={raised ? "h-6 w-6" : "h-5 w-5"} />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      active ? "text-brand-dark" : "text-ink-faint",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
