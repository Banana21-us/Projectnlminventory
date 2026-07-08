"use client";

import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ShelfTag } from "@/components/shelf-tag";
import { StatusBadge } from "@/components/stock";
import { Button } from "@/components/ui/button";
import { useFetch } from "@/lib/hooks";
import { CATEGORY_LABELS, type CountSheetRow } from "@/lib/types";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function CountSheetPage() {
  const [from, setFrom] = useState(() => isoDate(new Date(new Date().getFullYear(), 0, 1)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const { data: rows, loading } = useFetch<CountSheetRow[]>(
    `/api/reports/count-sheet?from=${from}&to=${to}`,
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const longDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const period = `${longDate(from)} — ${longDate(to)}`;

  const sorted = [...(rows ?? [])].sort(
    (a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name),
  );

  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/reports/count-sheet-pdf?from=${from}&to=${to}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not generate count sheet");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nlm-count-sheet-${from}_to_${to}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Could not generate count sheet");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/inventory"
            className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Inventory
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Inventory Count Sheet</h1>
          <p className="mt-1 text-sm text-ink-soft">{period}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" disabled={downloading} onClick={downloadPdf}>
            <Download className="h-4 w-4" /> {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-end gap-3 rounded-xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-line bg-bg px-2.5 font-mono text-[13px] text-ink focus:border-brand focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-line bg-bg px-2.5 font-mono text-[13px] text-ink focus:border-brand focus:outline-none"
          />
        </label>
        <p className="w-full text-[11px] text-ink-faint">
          Beginning and ending balances are computed from the movement ledger for the chosen
          period — e.g. Jan 1 to Dec 31 for a full-year count.
        </p>
      </div>
      {downloadError && (
        <p className="no-print text-[13px] font-medium text-danger">{downloadError}</p>
      )}

      <div id="print-area" className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
        <div className="hidden border-b border-line px-5 py-4 print:block">
          <p className="text-lg font-bold text-ink">Northern Luzon Mission — Inventory Count Sheet</p>
          <p className="text-sm text-ink-soft">{period}</p>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-line/60" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="px-4 py-14 text-center text-[13px] text-ink-faint">No stock rows found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-ink-faint">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Shelf</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3 text-right">Beginning</th>
                  <th className="px-3 py-3 text-right">In</th>
                  <th className="px-3 py-3 text-right">Out</th>
                  <th className="px-3 py-3 text-right">Ending</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sorted.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-3 text-ink-soft">{CATEGORY_LABELS[row.category]}</td>
                    <td className="px-3 py-3">
                      <ShelfTag code={row.shelf} />
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{row.location}</td>
                    <td className="px-3 py-3 text-right font-mono text-ink-soft">{row.beginning}</td>
                    <td className="px-3 py-3 text-right font-mono text-success">
                      {row.inQty > 0 ? `+${row.inQty}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-ember-dark">
                      {row.outQty > 0 ? `−${row.outQty}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-ink">
                      {row.ending} {row.unit}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge item={{ stock: row.ending, maxStock: row.maxStock }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
