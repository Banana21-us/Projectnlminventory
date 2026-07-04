"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Cross, House, Package, ScrollText, Send, User, Loader } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/dispense", label: "Dispense", icon: Send },
  { href: "/log", label: "Log", icon: ScrollText },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ember text-white shadow-sm">
        <Cross className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight text-ink">
            Mission Supply
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
  const { status } = useSession();

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
          <Wordmark compact />
        </div>
        <nav className="flex flex-col items-center gap-1 lg:items-stretch">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center justify-center gap-3 rounded-lg transition-colors sm:w-11 lg:w-auto lg:justify-start lg:px-3",
                  active
                    ? "bg-brand-tint text-brand-dark"
                    : "text-ink-soft hover:bg-bg hover:text-ink",
                )}
                title={label}
              >
                <Icon
                  className={cn("h-5 w-5 shrink-0", active ? "text-brand" : "text-ink-faint")}
                />
                <span className="hidden text-sm font-medium lg:inline">{label}</span>
                {active && (
                  <span className="absolute inset-y-2 left-0 hidden w-1 rounded-full bg-brand lg:block" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden rounded-lg bg-ember-tint p-3 lg:block">
          <p className="text-xs font-semibold text-ember-dark">Central Storeroom</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">Mission station stores</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-surface/90 px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
          <Wordmark />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pb-10 sm:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar with raised dispense action */}
      <nav className="fixed inset-x-0 bottom-0 z-30 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(0,0,0,0.06)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
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
    </div>
  );
}
