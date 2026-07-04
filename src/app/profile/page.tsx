"use client";

import { LogOut, MapPin, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react"
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CURRENT_USER, canManageInventory } from "@/lib/session";

const PERMISSIONS: { label: string; allowed: boolean }[] = [
  { label: "Dispense stock", allowed: true },
  { label: "View movement log", allowed: true },
  { label: "Add & edit items", allowed: canManageInventory(CURRENT_USER.role) },
  { label: "Manage users", allowed: CURRENT_USER.role === "ADMIN" },
];

export default function ProfilePage() {
  const initials = CURRENT_USER.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Profile</h1>

      <section className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-lg font-bold text-brand-dark">
            {initials}
          </span>
          <div>
            <p className="text-base font-semibold text-ink">{CURRENT_USER.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="brand">
                <ShieldCheck className="h-3 w-3" /> {CURRENT_USER.role}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-ink-soft">
                <MapPin className="h-3 w-3" /> {CURRENT_USER.station}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
        <header className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">
            What this role can do
          </h2>
        </header>
        <ul className="divide-y divide-line">
          {PERMISSIONS.map((p) => (
            <li
              key={p.label}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <span className={p.allowed ? "text-ink" : "text-ink-faint line-through"}>
                {p.label}
              </span>
              <span
                className={`text-xs font-medium ${
                  p.allowed ? "text-success" : "text-ink-faint"
                }`}
              >
                {p.allowed ? "Allowed" : "No access"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="outline" className="w-full" onClick={() => signOut({ callbackUrl: "/login" })}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
