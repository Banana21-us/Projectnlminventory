import {
  STATUS_LABELS,
  stockStatus,
  type Item,
  type StockStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<
  StockStatus,
  { bar: string; dot: string; pill: string }
> = {
  ok: { bar: "bg-success", dot: "bg-success", pill: "bg-success-tint text-success" },
  low: { bar: "bg-warning", dot: "bg-warning", pill: "bg-warning-tint text-warning" },
  critical: { bar: "bg-danger", dot: "bg-danger", pill: "bg-danger-tint text-danger" },
};

export function StockGauge({
  item,
  className,
}: {
  item: Pick<Item, "stock" | "maxStock">;
  className?: string;
}) {
  const status = stockStatus(item);
  const pct = Math.min(100, Math.round((item.stock / Math.max(1, item.maxStock)) * 100));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div
        className={cn("h-full rounded-full transition-[width]", STATUS_COLORS[status].bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatusBadge({ item }: { item: Pick<Item, "stock" | "maxStock"> }) {
  const status = stockStatus(item);
  const c = STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        c.pill,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StockCount({ item }: { item: Pick<Item, "stock" | "unit"> }) {
  return (
    <span className="font-mono text-xs tabular-nums text-ink-soft">
      <span className="font-semibold text-ink">{item.stock}</span>
      {" "}
      {item.unit}
    </span>
  );
}
