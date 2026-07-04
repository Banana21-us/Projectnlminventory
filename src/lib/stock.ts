import { Prisma, type MovementType, type DispensePurpose } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./dal";

// Stock domain service — all quantity/cost mutations go through here so
// the weighted-average and ledger rules live in exactly one place.

const MOVEMENT_INCLUDE = {
  item: { include: { category: true } },
  stockroom: true,
  user: true,
  recipient: { include: { district: true } },
} as const;

export interface StockActionInput {
  stockId: string; // ItemStock id
  userId: string;
  qty: number; // always positive; sign is derived from type
  type: MovementType;
  purpose?: DispensePurpose;
  recipientId?: string;
  issuedToName?: string;
  unitCost?: number;
  unitPrice?: number;
  orNumber?: string;
  reference?: string;
  note?: string;
}

export async function applyStockAction(input: StockActionInput) {
  return prisma.$transaction(async (tx) => {
    const stock = await tx.itemStock.findUnique({
      where: { id: input.stockId },
      include: { item: true },
    });
    if (!stock) throw new ApiError(404, "Item not found");

    const isInbound = input.type === "RECEIVE" || input.type === "TRANSFER_IN";
    let signedQty = isInbound ? input.qty : -input.qty;
    let unitCost = new Prisma.Decimal(input.unitCost ?? Number(stock.item.avgCost));

    if (input.type === "ADJUSTMENT") {
      signedQty = input.qty; // adjustments carry their own sign
      unitCost = stock.item.avgCost;
    }

    if (signedQty < 0 && stock.quantity < -signedQty) {
      throw new ApiError(
        409,
        `Only ${stock.quantity} ${stock.item.unit} of ${stock.item.name} remaining`,
      );
    }

    // Weighted average cost: recalculated only when stock comes in at a
    // known cost. Uses the item's total on hand across all stockrooms.
    if (input.type === "RECEIVE" && input.unitCost !== undefined) {
      const totals = await tx.itemStock.aggregate({
        where: { itemId: stock.itemId },
        _sum: { quantity: true },
      });
      const onHand = totals._sum.quantity ?? 0;
      const currentValue = new Prisma.Decimal(stock.item.avgCost).mul(onHand);
      const incomingValue = new Prisma.Decimal(input.unitCost).mul(input.qty);
      const newAvg = currentValue.add(incomingValue).div(onHand + input.qty);
      await tx.item.update({
        where: { id: stock.itemId },
        data: { avgCost: newAvg.toDecimalPlaces(2) },
      });
    }

    await tx.itemStock.update({
      where: { id: stock.id },
      data: { quantity: { increment: signedQty } },
    });

    return tx.movement.create({
      data: {
        itemId: stock.itemId,
        stockroomId: stock.stockroomId,
        userId: input.userId,
        type: input.type,
        purpose: input.purpose,
        recipientId: input.recipientId,
        issuedToName: input.issuedToName,
        qty: signedQty,
        unitCost,
        unitPrice:
          input.unitPrice !== undefined ? new Prisma.Decimal(input.unitPrice) : undefined,
        orNumber: input.orNumber,
        reference: input.reference,
        note: input.note,
      },
      include: MOVEMENT_INCLUDE,
    });
  });
}

/** Move quantity from one stockroom's shelf to another (bulk transfer). */
export async function transferStock(stockId: string, targetStockroomId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.itemStock.findUnique({
      where: { id: stockId },
      include: { item: true },
    });
    if (!source) throw new ApiError(404, "Item not found");
    if (source.stockroomId === targetStockroomId || source.quantity <= 0) return null;

    const target = await tx.itemStock.upsert({
      where: {
        itemId_stockroomId: { itemId: source.itemId, stockroomId: targetStockroomId },
      },
      update: { quantity: { increment: source.quantity } },
      create: {
        itemId: source.itemId,
        stockroomId: targetStockroomId,
        shelf: source.shelf,
        quantity: source.quantity,
        maxStock: source.maxStock,
      },
    });
    await tx.itemStock.update({ where: { id: source.id }, data: { quantity: 0 } });

    const base = {
      itemId: source.itemId,
      userId,
      unitCost: source.item.avgCost,
      reference: "Stock transfer",
    };
    await tx.movement.create({
      data: {
        ...base,
        stockroomId: source.stockroomId,
        type: "TRANSFER_OUT",
        qty: -source.quantity,
      },
    });
    await tx.movement.create({
      data: {
        ...base,
        stockroomId: targetStockroomId,
        type: "TRANSFER_IN",
        qty: source.quantity,
      },
    });
    return target;
  });
}
