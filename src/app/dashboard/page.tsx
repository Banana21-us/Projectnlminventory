"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  Coins,
  Package,
  Receipt,
  Send,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { HorizontalBars, VerticalBars } from "@/components/charts/bars";
import { ChartCard } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { ShelfTag } from "@/components/shelf-tag";
import { StatusBadge, StockCount, StockGauge } from "@/components/stock";
import { useFetch } from "@/lib/hooks";
import { formatCompact, formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-user";
import {
  MOVEMENT_LABELS,
  expiryFlag,
  formatRelative,
  stockStatus,
  type DashboardData,
  type Item,
  type Movement,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;
type Range = (typeof RANGES)[number]["value"];

export default function DashboardPage() {
  const { name } = useCurrentUser();
  const { data: items, loading } = useFetch<Item[]>("/api/items");
  const { data: movements } = useFetch<Movement[]>("/api/movements");
  const [range, setRange] = useState<Range>("month");
  const { data: dashboard, loading: dashboardLoading } = useFetch<DashboardData>(
    `/api/reports/dashboard?range=${range}`,
  );

  const low = items?.filter((i) => stockStatus(i) !== "ok") ?? [];
  const expiring = items?.filter((i) => expiryFlag(i) !== null) ?? [];
  const t = dashboard?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Welcome back{name ? `, ${name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Northern Luzon Mission · here&apos;s the inventory at a glance.
          </p>
        </div>
        <Link
          href="/dispense"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ember px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember-dark"
        >
          <Send className="h-4 w-4" /> New slip
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<Package className="h-4 w-4" />}
          label="Items tracked"
          value={t?.itemsTracked ?? (loading ? 0 : items?.length ?? 0)}
          tone="brand"
          delay={0}
        />
        <StatTile
          icon={<Boxes className="h-4 w-4" />}
          label="Stock units on hand"
          value={t?.stockUnits ?? 0}
          format={formatCompact}
          tone="brand"
          delay={40}
        />
        <StatTile
          icon={<Coins className="h-4 w-4" />}
          label="Inventory value"
          value={t?.inventoryValue ?? 0}
          format={formatCurrencyCompact}
          tone="ember"
          delay={80}
        />
        <StatTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Sales revenue (all-time)"
          value={t?.salesRevenueAllTime ?? 0}
          format={formatCurrencyCompact}
          tone="ember"
          delay={120}
        />
        <StatTile
          icon={<TriangleAlert className="h-4 w-4" />}
          label="Low / critical stock"
          value={low.length}
          tone={low.length > 0 ? "warning" : "success"}
          delay={160}
        />
        <StatTile
          icon={<CalendarClock className="h-4 w-4" />}
          label="Near expiry"
          value={expiring.length}
          tone={expiring.length > 0 ? "danger" : "success"}
          delay={200}
        />
        <StatTile
          icon={<Send className="h-4 w-4" />}
          label="Dispensed (all-time)"
          value={t?.dispensedQtyAllTime ?? 0}
          format={formatCompact}
          tone="brand"
          delay={240}
        />
        <StatTile
          icon={<Receipt className="h-4 w-4" />}
          label="Dispense cost (all-time)"
          value={t?.dispensedCostAllTime ?? 0}
          format={formatCurrencyCompact}
          tone="ember"
          delay={280}
        />
      </div>

      {/* Period toggle — scopes the two trend charts below */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-ink-soft">Dispense trend by</span>
        <div className="flex rounded-lg bg-surface p-0.5 shadow-sm ring-1 ring-black/5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                range === r.value ? "bg-brand-tint text-brand-dark" : "text-ink-soft hover:text-ink",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Dispensed quantity"
          subtitle={`Units issued per ${range}`}
          table={
            dashboard && {
              headers: ["Period", "Units"],
              rows: dashboard.series.map((s) => [s.label, s.qty]),
            }
          }
        >
          {dashboardLoading || !dashboard ? (
            <ChartSkeleton />
          ) : (
            <VerticalBars data={dashboard.series.map((s) => ({ label: s.label, value: s.qty }))} />
          )}
        </ChartCard>

        <ChartCard
          title="Dispensed cost"
          subtitle={`Value issued per ${range}, at average cost`}
          table={
            dashboard && {
              headers: ["Period", "Cost"],
              rows: dashboard.series.map((s) => [s.label, formatCurrency(s.cost)]),
            }
          }
        >
          {dashboardLoading || !dashboard ? (
            <ChartSkeleton />
          ) : (
            <VerticalBars
              data={dashboard.series.map((s) => ({ label: s.label, value: s.cost }))}
              formatValue={formatCurrency}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Items by category"
          subtitle="Active items tracked in each category"
          table={
            dashboard && {
              headers: ["Category", "Items", "Stock units"],
              rows: dashboard.byCategory.map((c) => [c.name, c.count, c.units]),
            }
          }
        >
          {dashboardLoading || !dashboard ? (
            <ChartSkeleton horizontal />
          ) : (
            <HorizontalBars data={dashboard.byCategory.map((c) => ({ label: c.name, value: c.count }))} />
          )}
        </ChartCard>

        <ChartCard
          title="Movement types"
          subtitle="All-time count by ledger entry type"
          table={
            dashboard && {
              headers: ["Type", "Count"],
              rows: dashboard.byMovementType.map((m) => [MOVEMENT_LABELS[m.type] ?? m.type, m.count]),
            }
          }
        >
          {dashboardLoading || !dashboard ? (
            <ChartSkeleton horizontal />
          ) : (
            <HorizontalBars
              data={dashboard.byMovementType.map((m) => ({
                label: MOVEMENT_LABELS[m.type] ?? m.type,
                value: m.count,
              }))}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Most dispensed items"
        subtitle="All-time, by units issued"
        table={
          dashboard && {
            headers: ["Item", "Units"],
            rows: dashboard.topItems.map((i) => [i.name, i.qty]),
          }
        }
      >
        {dashboardLoading || !dashboard ? (
          <ChartSkeleton horizontal />
        ) : (
          <HorizontalBars data={dashboard.topItems.map((i) => ({ label: i.name, value: i.qty }))} />
        )}
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Restock list */}
        <section className="rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
          <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Restock soon</h2>
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
                      <p className="min-w-0 truncate text-sm font-medium text-ink">{item.name}</p>
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
            <h2 className="text-sm font-semibold text-ink">Recent movements</h2>
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
                    m.direction === "OUT" ? "bg-ember-tint text-ember-dark" : "bg-success-tint text-success"
                  }`}
                >
                  {m.direction}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    <span className="font-mono text-xs font-semibold">{m.qty}×</span> {m.itemName}
                    {m.issuedTo && <span className="text-ink-soft"> → {m.issuedTo}</span>}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-faint">{formatRelative(m.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ChartSkeleton({ horizontal }: { horizontal?: boolean }) {
  if (horizontal) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 animate-pulse rounded-md bg-line/60" style={{ width: `${90 - i * 15}%` }} />
        ))}
      </div>
    );
  }
  return <div className="h-40 animate-pulse rounded-lg bg-line/60" />;
}
