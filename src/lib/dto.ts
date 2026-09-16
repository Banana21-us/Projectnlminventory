import type { Prisma } from "@prisma/client";
import type {
  Booking as BookingDto,
  Item as ItemDto,
  Movement as MovementDto,
  RecipientDto,
} from "./types";
import { folioTotals, notionalValue, toDateString } from "./booking";

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

// ── Guesthouse ──────────────────────────────────────────────────

/** Everything the booking DTO needs. Detail views add the ledgers. */
export const BOOKING_INCLUDE = {
  room: true,
  createdBy: true,
  payments: { include: { payer: true, recordedBy: true }, orderBy: { paidAt: "asc" } },
  adjustments: { include: { createdBy: true }, orderBy: { createdAt: "asc" } },
  events: { include: { actor: true }, orderBy: { createdAt: "desc" } },
  stays: { include: { room: true }, orderBy: { fromDate: "asc" } },
} as const satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

export function toBookingDto(row: BookingRow, opts: { detail?: boolean } = {}): BookingDto {
  const totals = folioTotals(row);
  return {
    id: row.id,
    roomId: row.roomId,
    roomName: row.room.name,
    guestName: row.guestName,
    ...(row.contact ? { contact: row.contact } : {}),
    ...(row.recipientId ? { recipientId: row.recipientId } : {}),
    ...(row.groupId ? { groupId: row.groupId } : {}),
    ...(row.groupName ? { groupName: row.groupName } : {}),
    checkIn: toDateString(row.checkIn),
    checkOut: toDateString(row.checkOut),
    nights: row.nights,
    billedNights: row.billedNights,
    nightlyRate: Number(row.nightlyRate),
    occupants: row.occupants,
    status: row.status,
    ...(row.holdUntil ? { holdUntil: toDateString(row.holdUntil) } : {}),
    complimentary: row.complimentary,
    ...(row.compReason ? { compReason: row.compReason } : {}),
    ...(row.complimentary ? { notionalValue: notionalValue(row) } : {}),
    ...(row.cancelReason ? { cancelReason: row.cancelReason } : {}),
    ...(row.note ? { note: row.note } : {}),
    totals,
    createdBy: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
    ...(opts.detail
      ? {
          payments: row.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method,
            ...(p.payer ? { payerName: p.payer.name } : {}),
            ...(p.settledAt ? { settledAt: p.settledAt.toISOString() } : {}),
            ...(p.orNumber ? { orNumber: p.orNumber } : {}),
            ...(p.reference ? { reference: p.reference } : {}),
            ...(p.note ? { note: p.note } : {}),
            paidAt: p.paidAt.toISOString(),
            recordedBy: p.recordedBy.name,
          })),
          adjustments: row.adjustments.map((a) => ({
            id: a.id,
            kind: a.kind,
            amount: Number(a.amount),
            reason: a.reason,
            createdBy: a.createdBy.name,
            at: a.createdAt.toISOString(),
          })),
          events: row.events.map((e) => ({
            id: e.id,
            type: e.type,
            ...(e.detail ? { detail: e.detail } : {}),
            actor: e.actor.name,
            at: e.createdAt.toISOString(),
          })),
          stays: row.stays.map((s) => ({
            roomName: s.room.name,
            from: toDateString(s.fromDate),
            to: toDateString(s.toDate),
            ...(s.reason ? { reason: s.reason } : {}),
          })),
        }
      : {}),
  };
}
