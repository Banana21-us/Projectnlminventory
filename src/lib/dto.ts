import type { Prisma } from "@prisma/client";
import type { Item as ItemDto, Movement as MovementDto, RecipientDto } from "./types";

// DTO mappers — the Laravel API Resource layer. Only these shapes ever
// leave the server; Prisma models (with password hashes, cost internals
// the role shouldn't see, etc.) stay inside.

type StockRow = Prisma.ItemStockGetPayload<{
  include: {
    item: { include: { category: true } };
    stockroom: true;
    batches: true;
    assetUnits: true;
  };
}>;

function pickOrder<B extends { expiry: Date | null; receivedAt: Date }>(batches: B[]): B[] {
  return [...batches].sort((a, b) => {
    const ae = a.expiry?.getTime();
    const be = b.expiry?.getTime();
    if (ae != null && be != null && ae !== be) return ae - be;
    if (ae != null && be == null) return -1;
    if (ae == null && be != null) return 1;
    return a.receivedAt.getTime() - b.receivedAt.getTime();
  });
}

export function toItemDto(row: StockRow, opts: { withPricing: boolean }): ItemDto {
  const batches = pickOrder(row.batches);
  return {
    id: row.id,
    itemId: row.itemId,
    name: row.item.name,
    ...(row.item.model ? { model: row.item.model } : {}),
    category: row.item.category.type,
    categoryName: row.item.category.name,
    shelf: row.shelf,
    stockroomId: row.stockroomId,
    location: row.stockroom.name,
    stock: row.quantity,
    maxStock: row.maxStock,
    unit: row.item.unit,
    sellingPrice: opts.withPricing ? Number(row.item.sellingPrice) : 0,
    avgCost: opts.withPricing ? Number(row.item.avgCost) : 0,
    serialized: row.item.serialized,
    ...(row.item.notes ? { description: row.item.notes } : {}),
    ...(row.item.frequent ? { frequent: true } : {}),
    batches: batches.map((b) => ({
      id: b.id,
      code: b.code,
      qtyReceived: b.qtyReceived,
      qtyOnHand: b.qtyOnHand,
      receivedAt: b.receivedAt.toISOString(),
      ...(b.expiry ? { expiry: b.expiry.toISOString().slice(0, 10) } : {}),
      ...(b.note ? { note: b.note } : {}),
    })),
    ...(row.item.serialized
      ? {
          units: [...row.assetUnits]
            .sort((a, b) => a.serial.localeCompare(b.serial))
            .map((u) => ({ id: u.id, serial: u.serial, status: u.status })),
        }
      : {}),
  };
}

type RecipientRow = Prisma.RecipientGetPayload<{ include: { district: true } }>;

export function toRecipientDto(r: RecipientRow): RecipientDto {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    active: r.active,
    ...(r.email ? { email: r.email } : {}),
    ...(r.district ? { districtId: r.district.id, districtName: r.district.name } : {}),
  };
}

type MovementRow = Prisma.MovementGetPayload<{
  include: {
    item: { include: { category: true } };
    stockroom: true;
    user: true;
    recipient: { include: { district: true } };
    lines: { include: { batch: true; assetUnit: true } };
  };
}> & { shelf?: string };

const IN_TYPES = new Set(["RECEIVE", "TRANSFER_IN", "RETURN"]);

export function toMovementDto(m: MovementRow, shelf: string): MovementDto {
  const direction =
    m.type === "ADJUSTMENT" ? (m.qty < 0 ? "OUT" : "IN") : IN_TYPES.has(m.type) ? "IN" : "OUT";
  const recipientName = m.recipient
    ? m.recipient.district
      ? `${m.recipient.name} (${m.recipient.district.name})`
      : m.recipient.name
    : undefined;
  return {
    id: m.id,
    type: m.type,
    direction,
    itemName: m.item.name,
    serialized: m.item.serialized,
    category: m.item.category.name,
    shelf,
    location: m.stockroom.name,
    qty: Math.abs(m.qty),
    unit: m.item.unit,
    unitCost: Number(m.unitCost),
    ...(m.purpose ? { purpose: m.purpose } : {}),
    ...(recipientName || m.issuedToName
      ? { issuedTo: recipientName ?? m.issuedToName ?? undefined }
      : {}),
    ...(m.orNumber ? { orNumber: m.orNumber } : {}),
    ...(m.unitPrice !== null && m.unitPrice !== undefined
      ? { unitPrice: Number(m.unitPrice) }
      : {}),
    ...(m.reference ? { reference: m.reference } : {}),
    ...(m.writeOffReason ? { writeOffReason: m.writeOffReason } : {}),
    ...(m.note ? { note: m.note } : {}),
    ...(m.cancelledAt ? { cancelledAt: m.cancelledAt.toISOString() } : {}),
    lines: m.lines.map((l) => ({
      batchCode: l.batch.code,
      qty: l.qty,
      ...(l.assetUnit ? { serial: l.assetUnit.serial, unitId: l.assetUnitId! } : {}),
    })),
    staff: m.user.name,
    at: m.createdAt.toISOString(),
  };
}
