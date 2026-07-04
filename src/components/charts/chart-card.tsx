"use client";

import { Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  action,
  table,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Plain-HTML fallback table for the accessibility pass — every chart needs one. */
  table?: { headers: string[]; rows: (string | number)[][] } | null;
  className?: string;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      className={cn(
        "animate-fade-in rounded-xl bg-surface p-4 shadow-sm ring-1 ring-black/5 sm:p-5",
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {table && (
            <button
              onClick={() => setShowTable((v) => !v)}
              aria-label={showTable ? "Show chart" : "View as table"}
              title={showTable ? "Show chart" : "View as table"}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                showTable ? "bg-brand-tint text-brand-dark" : "text-ink-faint hover:bg-bg hover:text-ink",
              )}
            >
              <Table2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {showTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-ink-faint">
                {table.headers.map((h) => (
                  <th key={h} className="px-2 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1.5 font-mono text-[13px] tabular-nums text-ink">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
