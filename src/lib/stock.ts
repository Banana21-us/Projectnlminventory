import {
  Prisma,
  type AssetUnitStatus,
  type Batch,
  type DispensePurpose,
  type MovementType,
  type WriteOffReason,
} from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./errors";

// Stock domain service — all quantity/cost mutations go through here so
// the weighted-average, batch/FEFO-FIFO, and ledger rules live in exactly
// one place.

const MOVEMENT_INCLUDE = {
  item: { include: { category: true } },
  stockroom: true,
  user: true,
  recipient: { include: { district: true } },
  lines: { include: { batch: true, assetUnit: true } },
} as const;

type Line = { batchId: string; qty: number; assetUnitId: string | null };

// Neon's pooled connection has much higher round-trip latency than local
// MySQL, so these interactive transactions (several sequential awaited
// queries each) need more room than Prisma's 5s default.
const TX_OPTS = { timeout: 20_000, maxWait: 10_000 };

// Batch pick order: earliest expiry first (FEFO) when the item dates its
// stock, oldest received first (FIFO) otherwise — expiring stock always
// drains before undated stock of the same item.
function pickOrder<B extends Pick<Batch, "id" | "expiry" | "receivedAt" | "qtyOnHand">>(
  batches: B[],
): B[] {
  return [...batches].sort((a, b) => {
    const ae = a.expiry?.getTime();
    const be = b.expiry?.getTime();
    if (ae != null && be != null && ae !== be) return ae - be;
    if (ae != null && be == null) return -1;
    if (ae == null && be != null) return 1;
    return a.receivedAt.getTime() - b.receivedAt.getTime();
  });
}

function allocate(batches: Batch[], qty: number): Line[] | null {
  const available = batches.reduce((s, b) => s + b.qtyOnHand, 0);
  if (available < qty) return null;
  const result: Line[] = [];
  let remaining = qty;
  for (const b of pickOrder(batches)) {
    if (remaining === 0) break;
    const take = Math.min(b.qtyOnHand, remaining);
    if (take === 0) continue;
    result.push({ batchId: b.id, qty: take, assetUnitId: null });
    remaining -= take;
  }
  return result;
}

function autoBatchCode(): string {
  const d = new Date();
  const ymd =
    String(d.getFullYear() % 100).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  return `B-${ymd}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

async function restoreLines(tx: Prisma.TransactionClient, lines: Line[]) {
  for (const l of lines) {
    await tx.batch.update({ where: { id: l.batchId }, data: { qtyOnHand: { increment: l.qty } } });
  }
  const unitIds = lines.map((l) => l.assetUnitId).filter((id): id is string => !!id);
  if (unitIds.length > 0) {
    await tx.assetUnit.updateMany({ where: { id: { in: unitIds } }, data: { status: "IN_STOCK" } });
  }
}

async function drainLines(
  tx: Prisma.TransactionClient,
  lines: Line[],
  unitStatus: AssetUnitStatus,
) {
  for (const l of lines) {
    await tx.batch.update({ where: { id: l.batchId }, data: { qtyOnHand: { decrement: l.qty } } });
  }
  const unitIds = lines.map((l) => l.assetUnitId).filter((id): id is string => !!id);
  if (unitIds.length > 0) {
    // stockId is left as-is (even once WRITTEN_OFF): it records where the
    // unit physically was, and toItemDto keys off `status`, not stockId,
    // to decide whether a unit still counts toward that stockroom's stock.
    await tx.assetUnit.updateMany({ where: { id: { in: unitIds } }, data: { status: unitStatus } });
  }
}

export interface StockActionInput {
  stockId: string; // ItemStock id
  userId: string;
  qty: number; // magnitude for RECEIVE/DISPENSE/SALE/WRITE_OFF; signed for ADJUSTMENT
  type: Extract<MovementType, "RECEIVE" | "DISPENSE" | "SALE" | "ADJUSTMENT" | "WRITE_OFF">;
  purpose?: DispensePurpose;
  recipientId?: string;
  issuedToName?: string;
  unitCost?: number;
  unitPrice?: number;
  orNumber?: string;
  reference?: string;
  note?: string;
  batchId?: string; // outbound override: draw only from this batch
  batchCode?: string; // inbound (RECEIVE): lot code, auto-generated if omitted
  expiry?: string; // inbound (RECEIVE): ISO date
  serials?: string[]; // inbound (RECEIVE), serialized items: new serial numbers
  unitIds?: string[]; // outbound, serialized items: explicit units to take
  writeOffReason?: WriteOffReason; // WRITE_OFF only
}

export async function applyStockAction(input: StockActionInput) {
  return prisma.$transaction(async (tx) => {
    const stock = await tx.itemStock.findUnique({
      where: { id: input.stockId },
      include: { item: true, batches: true, assetUnits: true },
    });
    if (!stock) throw new ApiError(404, "Item not found");
    const serialized = stock.item.serialized;

    const inbound = input.type === "RECEIVE" || (input.type === "ADJUSTMENT" && input.qty > 0);
    const magnitude = input.type === "ADJUSTMENT" ? Math.abs(input.qty) : input.qty;

    let lines: Line[];
    let qty: number;
    let unitCost = new Prisma.Decimal(input.unitCost ?? Number(stock.item.avgCost));

    if (inbound) {
      qty = magnitude;
      if (serialized) {
        const serials = (input.serials ?? []).map((s) => s.trim()).filter(Boolean);
        if (serials.length === 0) throw new ApiError(422, "Enter the serial numbers being received");
        if (new Set(serials.map((s) => s.toUpperCase())).size !== serials.length) {
          throw new ApiError(422, "Serial numbers must be unique");
        }
        const clash = await tx.assetUnit.findFirst({
          where: { itemId: stock.itemId, serial: { in: serials } },
        });
        if (clash) throw new ApiError(409, `Serial ${clash.serial} already exists for this item`);
        qty = serials.length;

        const batch = await tx.batch.create({
          data: {
            itemStockId: stock.id,
            code: input.batchCode?.trim() || autoBatchCode(),
            qtyReceived: qty,
            qtyOnHand: qty,
            expiry: input.expiry ? new Date(input.expiry) : null,
            note: input.type === "ADJUSTMENT" ? "Stock adjustment" : (input.reference ?? null),
          },
        });
        const units = await Promise.all(
          serials.map((serial) =>
            tx.assetUnit.create({
              data: { itemId: stock.itemId, stockId: stock.id, batchId: batch.id, serial },
            }),
          ),
        );
        lines = units.map((u) => ({ batchId: batch.id, qty: 1, assetUnitId: u.id }));
      } else {
        if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(422, "Quantity must be at least 1");
        const batch = await tx.batch.create({
          data: {
            itemStockId: stock.id,
            code: input.batchCode?.trim() || autoBatchCode(),
            qtyReceived: qty,
            qtyOnHand: qty,
            expiry: input.expiry ? new Date(input.expiry) : null,
            note: input.type === "ADJUSTMENT" ? "Stock adjustment" : (input.reference ?? null),
          },
        });
        lines = [{ batchId: batch.id, qty, assetUnitId: null }];
      }

      // Weighted average cost, only on a true RECEIVE with a known cost.
      if (input.type === "RECEIVE" && input.unitCost !== undefined) {
        const totals = await tx.itemStock.aggregate({
          where: { itemId: stock.itemId },
          _sum: { quantity: true },
        });
        const onHand = totals._sum.quantity ?? 0;
        const currentValue = new Prisma.Decimal(stock.item.avgCost).mul(onHand);
        const incomingValue = new Prisma.Decimal(input.unitCost).mul(qty);
        const newAvg = currentValue.add(incomingValue).div(onHand + qty);
        await tx.item.update({
          where: { id: stock.itemId },
          data: { avgCost: newAvg.toDecimalPlaces(2) },
        });
        unitCost = new Prisma.Decimal(input.unitCost);
      }
    } else {
      qty = magnitude;
      if (serialized) {
        if (input.unitIds && input.unitIds.length > 0) {
          const units = stock.assetUnits.filter(
            (u) => input.unitIds!.includes(u.id) && u.status === "IN_STOCK",
          );
          if (units.length !== input.unitIds.length) {
            throw new ApiError(409, "One or more selected serials are not in stock here");
          }
          qty = units.length;
          lines = units.map((u) => ({ batchId: u.batchId!, qty: 1, assetUnitId: u.id }));
        } else {
          if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(422, "Quantity must be at least 1");
          const batchOrder = new Map(stock.batches.map((b) => [b.id, b.receivedAt.getTime()]));
          const pick = stock.assetUnits
            .filter((u) => u.status === "IN_STOCK")
            .sort(
              (a, b) =>
                (batchOrder.get(a.batchId ?? "") ?? 0) - (batchOrder.get(b.batchId ?? "") ?? 0) ||
                a.serial.localeCompare(b.serial),
            )
            .slice(0, qty);
          if (pick.length < qty) {
            throw new ApiError(
              409,
              `Only ${pick.length} ${stock.item.unit} of ${stock.item.name} remaining`,
            );
          }
          lines = pick.map((u) => ({ batchId: u.batchId!, qty: 1, assetUnitId: u.id }));
        }
        const unitIds = lines.map((l) => l.assetUnitId!);
        await tx.assetUnit.updateMany({
          where: { id: { in: unitIds } },
          data: { status: input.type === "WRITE_OFF" ? "WRITTEN_OFF" : "ISSUED" },
        });
      } else {
        const pool = input.batchId ? stock.batches.filter((b) => b.id === input.batchId) : stock.batches;
        if (input.batchId && pool.length === 0) throw new ApiError(404, "Batch not found");
        const allocation = allocate(pool, qty);
        if (!allocation) {
          const available = pool.reduce((s, b) => s + b.qtyOnHand, 0);
          throw new ApiError(
            409,
            `Only ${available} ${stock.item.unit} of ${stock.item.name} ${
              input.batchId ? "in that batch" : "remaining"
            }`,
          );
        }
        lines = allocation;
      }

      for (const line of lines) {
        await tx.batch.update({
          where: { id: line.batchId },
          data: { qtyOnHand: { decrement: line.qty } },
        });
      }
    }

    const signedQty = inbound ? qty : -qty;
    await tx.itemStock.update({ where: { id: stock.id }, data: { quantity: { increment: signedQty } } });

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
        unitPrice: input.unitPrice !== undefined ? new Prisma.Decimal(input.unitPrice) : undefined,
        orNumber: input.orNumber,
        reference: input.reference,
        writeOffReason: input.writeOffReason,
        note: input.note,
        lines: { create: lines.map((l) => ({ batchId: l.batchId, qty: l.qty, assetUnitId: l.assetUnitId })) },
      },
      include: MOVEMENT_INCLUDE,
    });
  }, TX_OPTS);
}

/**
 * Void a DISPENSE/SALE (double entry, mistaken issue): restores the exact
 * batches/serials it drew from and appends a compensating ADJUSTMENT to the
 * ledger — the original row is stamped `cancelledAt`, never deleted.
 */
export async function cancelStockMovement(movementId: string, userId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.movement.findUnique({
      where: { id: movementId },
      include: { item: true, lines: true },
    });
    if (!movement) throw new ApiError(404, "Movement not found");
    if (movement.type !== "DISPENSE" && movement.type !== "SALE") {
      throw new ApiError(422, "Only dispenses and sales can be cancelled");
    }
    if (movement.cancelledAt) throw new ApiError(409, "This movement is already cancelled");

    const returnedQty = -movement.qty; // dispense qty is negative; put it back
    await tx.itemStock.upsert({
      where: { itemId_stockroomId: { itemId: movement.itemId, stockroomId: movement.stockroomId } },
      update: { quantity: { increment: returnedQty } },
      create: { itemId: movement.itemId, stockroomId: movement.stockroomId, quantity: returnedQty },
    });
    const lines: Line[] = movement.lines.map((l) => ({
      batchId: l.batchId,
      qty: l.qty,
      assetUnitId: l.assetUnitId,
    }));
    await restoreLines(tx, lines);

    await tx.movement.create({
      data: {
        itemId: movement.itemId,
        stockroomId: movement.stockroomId,
        userId,
        type: "ADJUSTMENT",
        qty: returnedQty,
        unitCost: movement.unitCost,
        recipientId: movement.recipientId,
        issuedToName: movement.issuedToName,
        reference: movement.id,
        note: `Cancelled ${movement.type.toLowerCase()}: ${reason}`,
        lines: { create: lines.map((l) => ({ batchId: l.batchId, qty: l.qty, assetUnitId: l.assetUnitId })) },
      },
    });

    return tx.movement.update({
      where: { id: movement.id },
      data: { cancelledAt: new Date() },
      include: MOVEMENT_INCLUDE,
    });
  }, TX_OPTS);
}

export interface ReturnInput {
  movementId: string;
  userId: string;
  qty?: number; // non-serialized; defaults to full outstanding
  unitIds?: string[]; // serialized
  condition: "GOOD" | WriteOffReason;
  note?: string;
}

/**
 * Return goods from a DISPENSE/SALE. "GOOD" restocks into the batch(es) it
 * came from; any other condition restocks and immediately writes the same
 * quantity off again with that reason — net stock is unchanged, but the
 * ledger carries both the return and the reason it isn't sellable.
 */
export async function returnStockMovement(input: ReturnInput) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.movement.findUnique({
      where: { id: input.movementId },
      include: { item: true, lines: { include: { assetUnit: true } } },
    });
    if (!original) throw new ApiError(404, "Movement not found");
    if (original.type !== "DISPENSE" && original.type !== "SALE") {
      throw new ApiError(422, "Only dispenses and sales can be returned");
    }
    if (original.cancelledAt) throw new ApiError(409, "This movement was cancelled");

    const priorReturns = await tx.movement.findMany({
      where: { reference: original.id, type: "RETURN" },
      include: { lines: true },
    });
    const alreadyReturned = priorReturns.reduce((s, r) => s + r.qty, 0);
    const outstanding = -original.qty - alreadyReturned;

    let lines: Line[];
    let qty: number;

    if (original.item.serialized) {
      const unitIds = input.unitIds ?? [];
      if (unitIds.length === 0) throw new ApiError(422, "Select the serials being returned");
      const issuedLines = original.lines.filter((l) => l.assetUnitId && unitIds.includes(l.assetUnitId));
      if (issuedLines.length !== unitIds.length) {
        throw new ApiError(409, "Those serials were not part of this issue");
      }
      if (issuedLines.some((l) => l.assetUnit && l.assetUnit.status !== "ISSUED")) {
        throw new ApiError(409, "One or more of those serials are not currently issued");
      }
      qty = issuedLines.length;
      lines = issuedLines.map((l) => ({ batchId: l.batchId, qty: 1, assetUnitId: l.assetUnitId }));
    } else {
      qty = input.qty ?? outstanding;
      if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(422, "Quantity must be at least 1");
      if (qty > outstanding) {
        throw new ApiError(409, `Only ${outstanding} ${original.item.unit} can still be returned`);
      }
      // Refill the batches this issue actually drew from, in order,
      // skipping whatever earlier returns already put back into each.
      const refunded = new Map<string, number>();
      for (const r of priorReturns) {
        for (const l of r.lines) refunded.set(l.batchId, (refunded.get(l.batchId) ?? 0) + l.qty);
      }
      lines = [];
      let remaining = qty;
      for (const line of original.lines) {
        if (remaining === 0) break;
        const used = refunded.get(line.batchId) ?? 0;
        const room = Math.max(0, line.qty - used);
        const back = Math.min(room, remaining);
        if (back === 0) continue;
        refunded.set(line.batchId, used + back);
        lines.push({ batchId: line.batchId, qty: back, assetUnitId: null });
        remaining -= back;
      }
      if (remaining > 0) throw new ApiError(409, "Return exceeds what this issue dispensed");
    }

    await tx.itemStock.update({
      where: { itemId_stockroomId: { itemId: original.itemId, stockroomId: original.stockroomId } },
      data: { quantity: { increment: qty } },
    });
    await restoreLines(tx, lines);

    const returnMovement = await tx.movement.create({
      data: {
        itemId: original.itemId,
        stockroomId: original.stockroomId,
        userId: input.userId,
        type: "RETURN",
        qty,
        unitCost: original.unitCost,
        recipientId: original.recipientId,
        issuedToName: original.issuedToName,
        reference: original.id,
        note: input.note,
        lines: { create: lines.map((l) => ({ batchId: l.batchId, qty: l.qty, assetUnitId: l.assetUnitId })) },
      },
      include: MOVEMENT_INCLUDE,
    });

    if (input.condition !== "GOOD") {
      // Came back, but isn't sellable — write it straight off again. Net
      // stock effect is zero; the WRITE_OFF row carries the reason.
      await tx.itemStock.update({
        where: { itemId_stockroomId: { itemId: original.itemId, stockroomId: original.stockroomId } },
        data: { quantity: { decrement: qty } },
      });
      await drainLines(tx, lines, "WRITTEN_OFF");
      await tx.movement.create({
        data: {
          itemId: original.itemId,
          stockroomId: original.stockroomId,
          userId: input.userId,
          type: "WRITE_OFF",
          qty: -qty,
          unitCost: original.unitCost,
          reference: returnMovement.id,
          writeOffReason: input.condition,
          note: input.note ?? "Returned in bad condition",
          lines: {
            create: lines.map((l) => ({ batchId: l.batchId, qty: l.qty, assetUnitId: l.assetUnitId })),
          },
        },
      });
    }

    return returnMovement;
  }, TX_OPTS);
}

/** Move quantity — and its batches/serials — from one stockroom to another. */
export async function transferStock(stockId: string, targetStockroomId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.itemStock.findUnique({
      where: { id: stockId },
      include: { item: true, batches: true, assetUnits: true },
    });
    if (!source) throw new ApiError(404, "Item not found");
    if (source.stockroomId === targetStockroomId || source.quantity <= 0) return null;

    const target = await tx.itemStock.upsert({
      where: { itemId_stockroomId: { itemId: source.itemId, stockroomId: targetStockroomId } },
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

    // The batches (and their asset units) move with the stock — they keep
    // their lot code, expiry, and received date, just a new location.
    const movedBatches = source.batches.filter((b) => b.qtyOnHand > 0);
    if (movedBatches.length > 0) {
      await tx.batch.updateMany({
        where: { id: { in: movedBatches.map((b) => b.id) } },
        data: { itemStockId: target.id },
      });
    }
    const movedUnitIds = source.assetUnits.filter((u) => u.status !== "WRITTEN_OFF").map((u) => u.id);
    if (movedUnitIds.length > 0) {
      await tx.assetUnit.updateMany({ where: { id: { in: movedUnitIds } }, data: { stockId: target.id } });
    }

    const lines = movedBatches.map((b) => ({ batchId: b.id, qty: b.qtyOnHand }));
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
        lines: { create: lines },
      },
    });
    await tx.movement.create({
      data: {
        ...base,
        stockroomId: targetStockroomId,
        type: "TRANSFER_IN",
        qty: source.quantity,
        lines: { create: lines },
      },
    });
    return target;
  }, TX_OPTS);
}
