"use client";

import {
  BedDouble,
  Coins,
  Gift,
  Percent,
  Receipt,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { GuesthouseTabs } from "@/components/guesthouse/guesthouse-tabs";
import { HorizontalBars, VerticalBars } from "@/components/charts/bars";
import { ChartCard } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { useFetch } from "@/lib/hooks";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import type { DashboardRangeKey, GuesthouseReport } from "@/lib/types";

const RANGES: { value: DashboardRangeKey; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export default function GuesthouseAccountingPage() {
  const [range, setRange] = useState<DashboardRangeKey>("month");
  const { data: report, loading } = useFetch<GuesthouseReport>(
    `/api/reports/guesthouse?range=${range}`,
  );
  const { data: receivables } = useFetch<
    { paymentId: string; guestName: string; payerName: string; amount: number; paidAt: string }[]
  >("/api/guesthouse/receivables");

  const t = report?.totals;

  return (
    <div className="space-y-6">
      <GuesthouseTabs />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Guesthouse accounting
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Revenue, supply cost, and net contribution.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-line/40 p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r.value ? "bg-surface text-ink shadow-sm" : "text-ink-soft"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {report?.lockedThrough && (
        <p className="rounded-lg bg-line/40 px-3 py-2 text-xs text-ink-soft">
          Books are closed through {report.lockedThrough}. Manage the lock from Rooms.
        </p>
      )}

      {loading && <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>}

      {t && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile
              icon={<Receipt className="h-4 w-4" />}
              label="Gross revenue"
              value={t.grossRevenue}
              format={formatCurrencyCompact}
              tone="brand"
            />
            <StatTile
              icon={<Percent className="h-4 w-4" />}
              label="Discounts given"
              value={t.discounts}
              format={formatCurrencyCompact}
              tone="warning"
            />
            <StatTile
              icon={<Wallet className="h-4 w-4" />}
              label="Net revenue"
              value={t.netRevenue}
              format={formatCurrencyCompact}
              tone="success"
            />
            <StatTile
              icon={<TrendingDown className="h-4 w-4" />}
              label="Supply cost"
              value={t.supplyCost}
              format={formatCurrencyCompact}
              tone="ember"
            />
            <StatTile
              icon={<TrendingUp className="h-4 w-4" />}
              label="Net contribution"
              value={t.netContribution}
              format={formatCurrencyCompact}
              tone="success"
            />
            <StatTile
              icon={<BedDouble className="h-4 w-4" />}
              label="Occupancy"
              value={t.occupancyPct}
              format={(v) => `${v.toFixed(1)}%`}
              tone="brand"
            />
            <StatTile
              icon={<Coins className="h-4 w-4" />}
              label="Avg. nightly rate"
              value={t.avgNightlyRate}
              format={formatCurrencyCompact}
              tone="brand"
            />
            <StatTile
              icon={<Gift className="h-4 w-4" />}
              label="Comped nights"
              value={t.compedNights}
              format={(v) => `${Math.round(v)} · ${formatCurrencyCompact(t.compedValue)}`}
              tone="success"
            />
            <StatTile
              icon={<TriangleAlert className="h-4 w-4" />}
              label="Cancelled / no-show"
              value={t.cancellations + t.noShows}
              format={() => `${t.cancellations} / ${t.noShows}`}
              tone="warning"
            />
            <StatTile
              icon={<Wallet className="h-4 w-4" />}
              label="Outstanding"
              value={t.outstanding}
              format={formatCurrencyCompact}
              tone={t.outstanding > 0 ? "danger" : "success"}
            />
          </div>

          <ChartCard
            title="Revenue vs. supply cost"
            subtitle="Net revenue per period, guesthouse supply cost from the movement ledger"
            table={{
              headers: ["Period", "Revenue", "Cost"],
              rows: report!.series.map((s) => [s.label, formatCurrency(s.revenue), formatCurrency(s.cost)]),
            }}
          >
            <div className="flex gap-6">
              <div className="flex-1">
                <p className="mb-2 text-xs text-ink-soft">Revenue</p>
                <VerticalBars
                  data={report!.series.map((s) => ({ label: s.label, value: s.revenue }))}
                  formatValue={formatCurrencyCompact}
                  color="var(--brand)"
                />
              </div>
              <div className="flex-1">
                <p className="mb-2 text-xs text-ink-soft">Supply cost</p>
                <VerticalBars
                  data={report!.series.map((s) => ({ label: s.label, value: s.cost }))}
                  formatValue={formatCurrencyCompact}
                  color="var(--ember)"
                />
              </div>
            </div>
          </ChartCard>

          {report!.roomPerformance.length > 0 && (
            <ChartCard
              title="Room performance"
              subtitle="Nights sold and revenue by room, this period"
              table={{
                headers: ["Room", "Nights", "Revenue", "Occupancy"],
                rows: report!.roomPerformance.map((r) => [
                  r.name,
                  r.nights,
                  formatCurrency(r.revenue),
                  `${r.occupancyPct}%`,
                ]),
              }}
            >
              <HorizontalBars
                data={report!.roomPerformance.map((r) => ({ label: r.name, value: r.revenue }))}
                formatValue={formatCurrencyCompact}
                color="var(--brand)"
              />
            </ChartCard>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {report!.discountsGiven.length > 0 && (
              <section className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Discounts given</h2>
                <ul className="space-y-2">
                  {report!.discountsGiven.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{d.guestName}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {d.reason} · {d.by}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-warning">
                        −{formatCurrency(d.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report!.outstandingBalances.length > 0 && (
              <section className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Outstanding balances</h2>
                <ul className="space-y-2">
                  {report!.outstandingBalances.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{o.guestName}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {o.roomName} · checked out {o.checkOut}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-danger">
                        {formatCurrency(o.balance)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report!.refundsDue.length > 0 && (
              <section className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Refunds due</h2>
                <ul className="space-y-2">
                  {report!.refundsDue.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{r.guestName}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {r.roomName} · checked out {r.checkOut}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-danger">
                        {formatCurrency(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {receivables && receivables.length > 0 && (
              <section className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5">
                <h2 className="mb-3 text-sm font-semibold text-ink">Department receivables</h2>
                <ul className="space-y-2">
                  {receivables.map((r) => (
                    <li key={r.paymentId} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{r.payerName}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {r.guestName} · {new Date(r.paidAt).toLocaleDateString("en-PH")}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-ink">{formatCurrency(r.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
