"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Package,
  Send,
  TriangleAlert,
} from "lucide-react";
import { ShelfTag } from "@/components/shelf-tag";
import { StatusBadge, StockCount, StockGauge } from "@/components/stock";
import { useFetch } from "@/lib/hooks";
import { CURRENT_USER } from "@/lib/session";
import {
  expiryFlag,
  formatRelative,
  stockStatus,
  type Item,
  type Movement,
} from "@/lib/types";

export default function HomePage() {
  const { data: items, loading } = useFetch<Item[]>("/api/items");
  const { data: movements } = useFetch<Movement[]>("/api/movements");

  const low = items?.filter((i) => stockStatus(i) !== "ok") ?? [];
  const expiring = items?.filter((i) => expiryFlag(i) !== null) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Welcome back, {CURRENT_USER.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {CURRENT_USER.station} · here&apos;s the station at a glance.
          </p>
        </div>
        <Link
          href="/dispense"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ember px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember-dark"
        >
          <Send className="h-4 w-4" /> New slip
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Items tracked"
          value={loading ? "—" : String(items?.length ?? 0)}
          tone="brand"
        />
        <StatCard
          icon={<TriangleAlert className="h-4 w-4" />}
          label="Low / critical"
          value={loading ? "—" : String(low.length)}
          tone={low.length > 0 ? "warning" : "success"}
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Near expiry"
          value={loading ? "—" : String(expiring.length)}
          tone={expiring.length > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Restock list */}
        <section className="rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
          <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-sm font-semibold text-ink">
              Restock soon
            </h2>
            <Link
              href="/inventory"
              className="flex items-center gap-1 text-xs font-medium text-brand-dark hover:underline"
            >
              Inventory <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </header>
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-line/60" />
              ))}
            </div>
          ) : low.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ink-faint">
              All stocked up — nothing needs reordering.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {low
                .sort((a, b) => a.stock / a.maxStock - b.stock / b.maxStock)
                .slice(0, 5)
                .map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-ink">
                        {item.name}
                      </p>
                      <StatusBadge item={item} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <ShelfTag code={item.shelf} />
                      <StockGauge item={item} className="flex-1" />
                      <StockCount item={item} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Recent movements */}
        <section className="rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
          <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-sm font-semibold text-ink">
              Recent movements
            </h2>
            <Link
              href="/log"
              className="flex items-center gap-1 text-xs font-medium text-brand-dark hover:underline"
            >
              Full log <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </header>
          <ul className="divide-y divide-line">
            {(movements ?? []).slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    m.type === "OUT"
                      ? "bg-ember-tint text-ember-dark"
                      : "bg-success-tint text-success"
                  }`}
                >
                  {m.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    <span className="font-mono text-xs font-semibold">{m.qty}×</span>{" "}
                    {m.itemName}
                    {m.issuedTo && (
                      <span className="text-ink-soft"> → {m.issuedTo}</span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {formatRelative(m.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const STAT_TONES = {
  brand: "bg-brand-tint text-brand-dark",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
} as const;

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className="rounded-xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5 sm:p-4">
      <div
        className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg ${STAT_TONES[tone]}`}
      >
        {icon}
      </div>
      <p className="font-mono text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-ink-soft">{label}</p>
    </div>
  );
}
