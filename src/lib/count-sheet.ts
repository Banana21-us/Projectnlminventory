import { toItemDto } from "./dto";
import { prisma } from "./prisma";
import type { CountSheetRow } from "./types";

// Count sheet for a date range, derived from the append-only ledger:
// ending = current on hand minus everything that moved after the range,
// beginning = ending minus the range's net movement. Historical balances
// therefore never drift, even as new movements come in.

/** `start` inclusive, `end` exclusive (midnight after the "to" date). */
export async function buildCountSheet(start: Date, end: Date): Promise<CountSheetRow[]> {
  const stocks = await prisma.itemStock.findMany({
    where: { item: { active: true }, stockroom: { active: true } },
    include: {
      item: { include: { category: true } },
      stockroom: true,
      batches: true,
      assetUnits: true,
    },
    orderBy: [{ stockroom: { name: "asc" } }, { shelf: "asc" }],
  });

  // Movement volume is small (single office), so bucket in JS like the
  // dashboard does rather than reaching for raw SQL group-bys.
  const movements = await prisma.movement.findMany({
    where: { createdAt: { gte: start } },
    select: { itemId: true, stockroomId: true, qty: true, createdAt: true },
  });

  const buckets = new Map<string, { after: number; inQty: number; outQty: number; net: number }>();
  for (const m of movements) {
    const key = `${m.itemId}:${m.stockroomId}`;
    let b = buckets.get(key);
    if (!b) {
      b = { after: 0, inQty: 0, outQty: 0, net: 0 };
      buckets.set(key, b);
    }
    if (m.createdAt >= end) {
      b.after += m.qty;
    } else {
      b.net += m.qty;
      if (m.qty >= 0) b.inQty += m.qty;
      else b.outQty += -m.qty;
    }
  }

  return stocks.map((row) => {
    const b = buckets.get(`${row.itemId}:${row.stockroomId}`);
    const ending = row.quantity - (b?.after ?? 0);
    return {
      ...toItemDto(row, { withPricing: false }),
      beginning: ending - (b?.net ?? 0),
      inQty: b?.inQty ?? 0,
      outQty: b?.outQty ?? 0,
      ending,
    };
  });
}
