"use client";

import { ShelfTag } from "@/components/shelf-tag";
import { useFetch } from "@/lib/hooks";
import { formatRelative, type Movement } from "@/lib/types";

export default function LogPage() {
  const { data: movements, loading } = useFetch<Movement[]>("/api/movements");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Movement log</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every issue and receipt, most recent first.
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
            <li key={m.id} className="flex items-start gap-3 px-4 py-3.5">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  m.type === "OUT"
                    ? "bg-ember-tint text-ember-dark"
                    : "bg-success-tint text-success"
                }`}
              >
                {m.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  <span className="font-mono text-xs font-semibold">
                    {m.qty} {m.unit}
                  </span>{" "}
                  · {m.itemName}
                  {m.issuedTo && <span className="text-ink-soft"> → {m.issuedTo}</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                  <ShelfTag code={m.shelf} />
                  <span>by {m.staff}</span>
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-ink-faint">
                {formatRelative(m.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
