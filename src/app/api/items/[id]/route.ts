import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { itemUpdateSchema } from "@/lib/validators";

export const PATCH = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireCan("inventory.manage");
  const { id } = await params;
  const data = await validate(request, itemUpdateSchema);

  // id from the client is the ItemStock id; resolve to the real Item id.
  const stock = await prisma.itemStock.findUnique({ where: { id }, include: { item: true } });
  if (!stock || !stock.item.active) throw new ApiError(404, "Item not found");

  const itemId = stock.itemId;

  if (data.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, active: true } });
    if (!category) throw new ApiError(422, "Unknown category");
  }

  const itemUpdate: Record<string, unknown> = {};
  if (data.name !== undefined) itemUpdate.name = data.name;
  if (data.model !== undefined) itemUpdate.model = data.model || null;
  if (data.categoryId !== undefined) itemUpdate.categoryId = data.categoryId;
  if (data.unit !== undefined) itemUpdate.unit = data.unit;
  if (data.unitCost !== undefined) itemUpdate.avgCost = data.unitCost;
  if (data.sellingPrice !== undefined) itemUpdate.sellingPrice = data.sellingPrice;
  if (data.description !== undefined) itemUpdate.notes = data.description || null;
  if (data.frequent !== undefined) itemUpdate.frequent = data.frequent;

  if (Object.keys(itemUpdate).length > 0) {
    await prisma.item.update({ where: { id: itemId }, data: itemUpdate });
  }

  if (data.shelf !== undefined || data.maxStock !== undefined) {
    const stockUpdate: Record<string, unknown> = {};
    if (data.shelf !== undefined) stockUpdate.shelf = data.shelf.toUpperCase();
    if (data.maxStock !== undefined) stockUpdate.maxStock = data.maxStock;
    await prisma.itemStock.update({ where: { id }, data: stockUpdate });
  }

  return Response.json({ ok: true });
});

export const DELETE = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireCan("inventory.manage");
  const { id } = await params;

  const stock = await prisma.itemStock.findUnique({ where: { id }, include: { item: true } });
  if (!stock || !stock.item.active) throw new ApiError(404, "Item not found");

  const itemId = stock.itemId;

  // Allow delete if the only movements are opening-stock RECEIVEs created
  // at item creation — reverse them before deactivating.
  const movements = await prisma.movement.findMany({ where: { itemId } });
  const hasRealHistory = movements.some((m) => m.reference !== "Opening stock");
  if (hasRealHistory) {
    throw new ApiError(
      409,
      "Cannot delete — this item has movement history. Deactivate it instead.",
    );
  }

  // Reverse any opening-stock RECEIVEs so stock balances stay correct.
  if (movements.length > 0) {
    const movementIds = movements.map((m) => m.id);
    await prisma.movementLine.deleteMany({ where: { movementId: { in: movementIds } } });
    await prisma.movement.deleteMany({ where: { itemId } });
  }
  await prisma.assetUnit.deleteMany({ where: { itemId } });
  await prisma.batch.deleteMany({ where: { itemStock: { itemId } } });
  await prisma.itemStock.deleteMany({ where: { itemId } });
  await prisma.item.update({ where: { id: itemId }, data: { active: false } });

  return Response.json({ ok: true });
});
