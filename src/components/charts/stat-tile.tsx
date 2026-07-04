"use client";

import type { ReactNode } from "react";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";

const TONES = {
  brand: "bg-brand-tint text-brand-dark",
  ember: "bg-ember-tint text-ember-dark",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
} as const;

export function StatTile({
  icon,
  label,
  value,
  format,
  tone,
  delay = 0,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  /** Formats the live animated number each frame — keep it cheap. */
  format?: (v: number) => string;
  tone: keyof typeof TONES;
  delay?: number;
}) {
  const animated = useCountUp(value);
  const display = format ? format(animated) : String(Math.round(animated));

  return (
    <div
      className="animate-fade-in rounded-xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5 sm:p-4"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className={cn("mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg", TONES[tone])}>
        {icon}
      </div>
      <p className="text-xl font-semibold tabular-nums text-ink">{display}</p>
      <p className="mt-0.5 text-[11px] font-medium text-ink-soft">{label}</p>
    </div>
  );
}
