"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { ReceiptSheet } from "@/components/receipt-sheet";
import { ShelfTag } from "@/components/shelf-tag";
import { Button } from "@/components/ui/button";
import { useFetch } from "@/lib/hooks";
import { MOVEMENT_LABELS, formatRelative, type Movement } from "@/lib/types";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function LogPage() {
  const { data: movements, loading, refetch } = useFetch<Movement[]>("/api/movements");
  const [selected, setSelected] = useState<Movement | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/reports/movements-pdf?from=${from}&to=${to}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Could not generate report");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nlm-movements-${from}_to_${to}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Could not generate report");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Movement log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every issue and receipt, most recent first. Tap an entry for its receipt.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5">
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
            max={isoDate(new Date())}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-line bg-bg px-2.5 font-mono text-[13px] text-ink focus:border-brand focus:outline-none"
          />
        </label>
        <Button size="default" disabled={downloading} onClick={downloadPdf}>
          <Download className="h-4 w-4" />
          {downloading ? "Preparing…" : "Download PDF report"}
        </Button>
        {downloadError && (
          <p className="w-full text-[13px] font-medium text-danger">{downloadError}</p>
        )}
        <p className="w-full text-[11px] text-ink-faint">
          Includes every movement in range with quantities, cost, and totals — ready for
          accounting.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-line/60" />
          ))}
        </div>
      ) : !movements || movements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
          <p className="text-sm font-medium text-ink">No movements yet</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Dispensed and received stock will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-black/5">
          {movements.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => setSelected(m)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    m.direction === "OUT"
                      ? "bg-ember-tint text-ember-dark"
                      : "bg-success-tint text-success"
                  }`}
                >
                  {MOVEMENT_LABELS[m.type] ?? m.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${m.cancelledAt ? "text-ink-faint line-through" : "text-ink"}`}>
                    <span className="font-mono text-xs font-semibold">
                      {m.qty} {m.unit}
                    </span>{" "}
                    · {m.itemName}
                    {m.issuedTo && <span className="text-ink-soft"> → {m.issuedTo}</span>}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                    {m.cancelledAt && (
                      <span className="rounded bg-danger/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-danger">
                        Cancelled
                      </span>
                    )}
                    <ShelfTag code={m.shelf} />
                    <span>by {m.staff}</span>
                    {m.note && <span className="italic">· {m.note}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {formatRelative(m.at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ReceiptSheet movement={selected} onClose={() => setSelected(null)} onCancelled={refetch} />
    </div>
  );
}
