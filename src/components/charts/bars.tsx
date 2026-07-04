"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
}

/** Mounts at 0 and grows on the next frame — the animated-entrance trigger every bar chart shares. */
function useGrowIn() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return grown;
}

/** Time-series / period comparisons — bars grow upward from a shared baseline. */
export function VerticalBars({
  data,
  formatValue = (v) => String(Math.round(v)),
  color = "var(--ember)",
  heightClass = "h-40",
}: {
  data: BarDatum[];
  formatValue?: (v: number) => string;
  color?: string;
  heightClass?: string;
}) {
  const grown = useGrowIn();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={cn("relative flex items-end gap-1.5 border-b border-line", heightClass)}>
      {data.map((d, i) => {
        const pct = grown ? (d.value / max) * 100 : 0;
        return (
          <div
            key={i}
            className="group relative flex h-full flex-1 flex-col items-center justify-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
          >
            {hover === i && (
              <div className="pointer-events-none absolute -top-9 z-10 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white shadow-lg">
                {formatValue(d.value)}
                <span className="ml-1 font-normal text-white/70">{d.label}</span>
              </div>
            )}
            <div
              className="w-full max-w-6 rounded-t-[4px] transition-[height] duration-700 ease-out"
              style={{
                height: `${pct}%`,
                minHeight: d.value > 0 ? 3 : 0,
                background: color,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
            <span className="mt-1.5 truncate text-[10px] text-ink-faint">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Rankings / category comparisons — bars grow rightward, one per row, longer labels fit naturally. */
export function HorizontalBars({
  data,
  formatValue = (v) => String(Math.round(v)),
  color = "var(--ember)",
}: {
  data: BarDatum[];
  formatValue?: (v: number) => string;
  color?: string;
}) {
  const grown = useGrowIn();
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-faint">No data yet.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => {
        const pct = grown ? (d.value / max) * 100 : 0;
        return (
          <li key={i} className="flex items-center gap-2.5">
            <span className="w-24 shrink-0 truncate text-xs font-medium text-ink-soft sm:w-32">
              {d.label}
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className="h-5 max-w-full rounded-r-[4px] transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%`, minWidth: d.value > 0 ? 3 : 0, background: color }}
              />
              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-ink">
                {formatValue(d.value)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
