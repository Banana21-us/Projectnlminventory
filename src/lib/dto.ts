import type { Prisma } from "@prisma/client";
import type { Item as ItemDto, Movement as MovementDto, RecipientDto } from "./types";

// DTO mappers — the Laravel API Resource layer. Only these shapes ever
// leave the server; Prisma models (with password hashes, cost internals
// the role shouldn't see, etc.) stay inside.

type StockRow = Prisma.ItemStockGetPayload<{
  include: { item: { include: { category: true } }; stockroom: true };
}>;

export function toItemDto(row: StockRow, opts: { withPricing: boolean }): ItemDto {
  return {
    id: row.id,
    itemId: row.itemId,
    name: row.item.name,
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
    ...(row.item.expiryDate
      ? { expiry: row.item.expiryDate.toISOString().slice(0, 10) }
      : {}),
    ...(row.item.frequent ? { frequent: true } : {}),
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
  };
}> & { shelf?: string };

const IN_TYPES = new Set(["RECEIVE", "TRANSFER_IN"]);

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
    ...(m.note ? { note: m.note } : {}),
    staff: m.user.name,
    at: m.createdAt.toISOString(),
  };
}
