export type DashboardRange = "day" | "week" | "month" | "year";

export interface Bucket {
  start: Date;
  end: Date;
  label: string;
}

const DAY_MS = 86_400_000;

/** Discrete time buckets for the dispense trend charts, widest-first (oldest → newest). */
export function buildBuckets(range: DashboardRange): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];

  if (range === "day") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 13; i >= 0; i--) {
      const start = new Date(today.getTime() - i * DAY_MS);
      const end = new Date(start.getTime() + DAY_MS);
      buckets.push({ start, end, label: start.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) });
    }
  } else if (range === "week") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 7; i >= 0; i--) {
      const end = new Date(today.getTime() - i * 7 * DAY_MS + DAY_MS);
      const start = new Date(end.getTime() - 7 * DAY_MS);
      buckets.push({ start, end, label: start.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) });
    }
  } else if (range === "month") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      buckets.push({
        start,
        end,
        label: start.toLocaleDateString("en-PH", { month: "short", year: start.getMonth() === 0 ? "2-digit" : undefined }),
      });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const year = now.getFullYear() - i;
      buckets.push({ start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), label: String(year) });
    }
  }

  return buckets;
}
