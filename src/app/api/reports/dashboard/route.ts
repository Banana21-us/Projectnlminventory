import { api, requireCan, ApiError } from "@/lib/dal";
import { buildBuckets, type DashboardRange } from "@/lib/dashboard-buckets";
import { prisma } from "@/lib/prisma";

const RANGES: DashboardRange[] = ["day", "week", "month", "year"];
const DISPENSE_TYPES = ["DISPENSE", "SALE"] as const;
const NEAR_EXPIRY_DAYS = 45;

export const GET = api(async (request) => {
  await requireCan("reports.view");
  const range = (new URL(request.url).searchParams.get("range") ?? "month") as DashboardRange;
  if (!RANGES.includes(range)) throw new ApiError(422, "Unknown range");

  const buckets = buildBuckets(range);
  const since = buckets[0].start;

  const [stocks, dispenseMovements, movementCounts, allMovements] = await Promise.all([
    prisma.itemStock.findMany({
      where: { item: { active: true }, stockroom: { active: true } },
      include: { item: { include: { category: true } } },
    }),
    prisma.movement.findMany({
      where: { type: { in: [...DISPENSE_TYPES] }, createdAt: { gte: since } },
      select: { qty: true, unitCost: true, unitPrice: true, type: true, createdAt: true, itemId: true },
    }),
    prisma.movement.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.movement.findMany({
      where: { type: { in: [...DISPENSE_TYPES] } },
      select: { qty: true, itemId: true, item: { select: { name: true } } },
    }),
  ]);

  // ── Inventory totals ──
  const itemIds = new Set(stocks.map((s) => s.itemId));
  const stockUnits = stocks.reduce((sum, s) => sum + s.quantity, 0);
  const inventoryValue = stocks.reduce((sum, s) => sum + s.quantity * Number(s.item.avgCost), 0);
  const lowStockCount = stocks.filter((s) => {
    const ratio = s.quantity / Math.max(1, s.maxStock);
    return s.quantity <= 0 || ratio <= 0.4;
  }).length;
  const expiringCount = stocks.filter((s) => {
    if (!s.item.expiryDate) return false;
    const days = Math.ceil((s.item.expiryDate.getTime() - Date.now()) / 86_400_000);
    return days <= NEAR_EXPIRY_DAYS;
  }).length;

  // ── Dispense trend (qty + cost per bucket) ──
  const series = buckets.map((b) => ({ label: b.label, qty: 0, cost: 0, revenue: 0 }));
  let dispensedQtyAllTime = 0;
  let dispensedCostAllTime = 0;
  let salesRevenueAllTime = 0;
  for (const m of dispenseMovements) {
    const qty = Math.abs(m.qty);
    const cost = qty * Number(m.unitCost);
    const revenue = m.unitPrice !== null ? qty * Number(m.unitPrice) : 0;
    dispensedQtyAllTime += qty;
    dispensedCostAllTime += cost;
    salesRevenueAllTime += revenue;
    const idx = buckets.findIndex((b) => m.createdAt >= b.start && m.createdAt < b.end);
    if (idx >= 0) {
      series[idx].qty += qty;
      series[idx].cost += cost;
      series[idx].revenue += revenue;
    }
  }

  // ── By category ──
  const categoryMap = new Map<string, { name: string; count: number; units: number }>();
  for (const s of stocks) {
    const key = s.item.category.name;
    const entry = categoryMap.get(key) ?? { name: key, count: 0, units: 0 };
    entry.units += s.quantity;
    categoryMap.set(key, entry);
  }
  // count distinct items per category (not stock rows, which repeat per stockroom)
  const seenPerCategory = new Map<string, Set<string>>();
  for (const s of stocks) {
    const key = s.item.category.name;
    const set = seenPerCategory.get(key) ?? new Set<string>();
    set.add(s.itemId);
    seenPerCategory.set(key, set);
  }
  const byCategory = Array.from(categoryMap.values())
    .map((c) => ({ ...c, count: seenPerCategory.get(c.name)?.size ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // ── By movement type ──
  const byMovementType = movementCounts
    .map((g) => ({ type: g.type, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  // ── Top dispensed items (all-time) ──
  const topItemsMap = new Map<string, { name: string; qty: number }>();
  for (const m of allMovements) {
    const entry = topItemsMap.get(m.itemId) ?? { name: m.item.name, qty: 0 };
    entry.qty += Math.abs(m.qty);
    topItemsMap.set(m.itemId, entry);
  }
  const topItems = Array.from(topItemsMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 6);

  return Response.json({
    totals: {
      itemsTracked: itemIds.size,
      stockUnits,
      inventoryValue,
      lowStockCount,
      expiringCount,
      dispensedQtyAllTime,
      dispensedCostAllTime,
      salesRevenueAllTime,
    },
    series,
    byCategory,
    byMovementType,
    topItems,
  });
});
