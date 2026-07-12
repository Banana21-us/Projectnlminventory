import { Prisma } from "@prisma/client";
import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { toItemDto } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { applyStockAction, transferStock } from "@/lib/stock";
import { itemBulkSchema, itemCreateSchema } from "@/lib/validators";

const STOCK_INCLUDE = {
  item: { include: { category: true } },
  stockroom: true,
  batches: true,
  assetUnits: true,
} as const;

export const GET = api(async () => {
  await requireCan("inventory.view");
  const rows = await prisma.itemStock.findMany({
    where: { item: { active: true }, stockroom: { active: true } },
    include: STOCK_INCLUDE,
    orderBy: [{ stockroom: { name: "asc" } }, { shelf: "asc" }],
  });
  return Response.json(rows.map((r) => toItemDto(r, { withPricing: true })));
});

export const POST = api(async (request) => {
  const user = await requireCan("inventory.manage");
  const data = await validate(request, itemCreateSchema);

  const [category, stockroom] = await Promise.all([
    prisma.category.findFirst({ where: { id: data.categoryId, active: true } }),
    prisma.stockroom.findFirst({ where: { id: data.stockroomId, active: true } }),
  ]);
  if (!category) throw new ApiError(422, "Unknown category");
  if (!stockroom) throw new ApiError(422, "Unknown stockroom");
  if (data.serialized && category.type !== "ASSET") {
    throw new ApiError(422, "Only assets can track serial numbers");
  }

  const unitCost = data.unitCost ?? 0;
  const serialized = data.serialized ?? false;
  const item = await prisma.item.create({
    data: {
      name: data.name,
      model: data.model,
      categoryId: category.id,
      unit: data.unit,
      sellingPrice: new Prisma.Decimal(data.sellingPrice ?? 0),
      avgCost: new Prisma.Decimal(unitCost),
      minStock: data.minStock ?? 0,
      frequent: data.frequent ?? false,
      serialized,
      notes: data.description ?? null,
    },
  });
  const stock = await prisma.itemStock.create({
    data: {
      itemId: item.id,
      stockroomId: stockroom.id,
      shelf: data.shelf.toUpperCase(),
      quantity: 0,
      maxStock: data.maxStock,
    },
  });

  const hasOpeningStock = serialized ? (data.serials?.length ?? 0) > 0 : data.stock > 0;
  if (hasOpeningStock) {
    await applyStockAction({
      stockId: stock.id,
      userId: user.id,
      qty: data.stock,
      type: "RECEIVE",
      unitCost,
      reference: "Opening stock",
      batchCode: data.batchCode,
      expiry: data.expiry,
      serials: data.serials,
    });
  }

  const row = await prisma.itemStock.findUniqueOrThrow({ where: { id: stock.id }, include: STOCK_INCLUDE });
  return Response.json(toItemDto(row, { withPricing: true }), { status: 201 });
});

// Bulk actions on stock rows: adjust, transfer between stockrooms, write off.
export const PATCH = api(async (request) => {
  const user = await requireCan("inventory.manage");
  const data = await validate(request, itemBulkSchema);

  const stocks = await prisma.itemStock.findMany({ where: { id: { in: data.ids } } });
  if (stocks.length === 0) throw new ApiError(404, "No matching items");

  if (data.action === "adjust") {
    const delta = data.delta!;
    for (const stock of stocks) {
      const applied = delta < 0 ? -Math.min(stock.quantity, -delta) : delta;
      if (applied === 0) continue;
      await applyStockAction({
        stockId: stock.id,
        userId: user.id,
        qty: applied,
        type: "ADJUSTMENT",
        reference: "Stock adjustment",
      });
    }
  } else if (data.action === "transfer") {
    const target = await prisma.stockroom.findFirst({
      where: { id: data.stockroomId!, active: true },
    });
    if (!target) throw new ApiError(422, "Unknown stockroom");
    for (const stock of stocks) {
      await transferStock(stock.id, target.id, user.id);
    }
  } else {
    for (const stock of stocks) {
      if (stock.quantity <= 0) continue;
      await applyStockAction({
        stockId: stock.id,
        userId: user.id,
        qty: stock.quantity,
        type: "WRITE_OFF",
        writeOffReason: data.writeOffReason,
        note: data.note,
        reference: "Stock write-off",
      });
    }
  }

  const updated = await prisma.itemStock.findMany({
    where: { id: { in: data.ids } },
    include: STOCK_INCLUDE,
  });
  return Response.json(updated.map((r) => toItemDto(r, { withPricing: true })));
});
