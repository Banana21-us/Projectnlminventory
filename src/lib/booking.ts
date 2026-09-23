import {
  Prisma,
  type AdjustmentKind,
  type BookingEventType,
  type BookingStatus,
  type PaymentMethod,
} from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./errors";

// Guesthouse domain service — every booking/room state change and every
// money row goes through here, so the lifecycle rules, availability checks
// and folio arithmetic live in exactly one place (the same discipline
// src/lib/stock.ts applies to quantities and costing).
//
// Derived, never stored:  charge = Σ nights × rate, per BookingRoomStay
//                         segment (0 if comped) — a room move bills the
//                         nights after it at the new room's own rate
//                         netTotal = charge − discounts + charges
//                         balance  = netTotal − payments
//                         room status = from BookingRoomStay + RoomBlock

// Neon's pooled connection makes interactive transactions slow; same
// allowance stock.ts uses.
const TX_OPTS = { timeout: 20_000, maxWait: 10_000 };

/** Statuses that still hold their room against new bookings. CHECKED_OUT is
 *  excluded — once a guest leaves, the room frees for rebooking immediately
 *  (gated only by `needsCleaning`, not by the nights already billed). */
const BLOCKING: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

/** Legal status moves. Everything else is rejected, and CHECKED_OUT /
 *  CANCELLED / NO_SHOW are terminal — a change of mind is a new booking. */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// ── Dates ───────────────────────────────────────────────────────
//
// Stays are date-only. Vercel runs UTC while the guesthouse is in Manila,
// so a local-midnight DateTime would shift a stay by a day and silently
// bill an extra night. Everything here is UTC midnight.

const DAY_MS = 86_400_000;

/** Parse "2026-09-18" (or a Date) to UTC midnight. */
export function dateOnly(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) throw new ApiError(422, "Invalid date");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Today in Asia/Manila, as a UTC-midnight date. */
export function todayInManila(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return dateOnly(ymd);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Nights between two date-only values (check-out is exclusive). */
export function nightsBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** "2026-09-18" — what the API hands the client for a date-only field. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ── Money ───────────────────────────────────────────────────────

const money = (v: Prisma.Decimal | number): number => Math.round(Number(v) * 100) / 100;

export interface FolioTotals {
  charge: number;
  discounts: number;
  extraCharges: number;
  netTotal: number;
  paid: number;
  balance: number;
}

type FolioStaySegment = {
  fromDate: Date;
  toDate: Date;
  rate: Prisma.Decimal | number;
};

type FolioInput = {
  checkIn: Date;
  billedNights: number;
  complimentary: boolean;
  status: BookingStatus;
  stays: FolioStaySegment[];
  payments: { amount: Prisma.Decimal | number }[];
  adjustments: { kind: AdjustmentKind; amount: Prisma.Decimal | number }[];
};

/**
 * Charge = sum of nights × that segment's own rate, clipped to the billed
 * window — a room move to a differently-priced room actually changes what
 * the nights after the move cost, instead of the whole stay keeping the
 * first room's rate. If billedNights runs past the last recorded segment
 * (a post-checkout upward correction), the remainder bills at that last
 * segment's rate, matching the old flat-rate behavior for that edge case.
 */
function segmentedCharge(checkIn: Date, billedNights: number, stays: FolioStaySegment[]): number {
  if (billedNights <= 0 || stays.length === 0) return 0;
  const billingEnd = addDays(checkIn, billedNights);
  const sorted = [...stays].sort((a, b) => +a.fromDate - +b.fromDate);

  let total = 0;
  let coveredUntil = checkIn;
  for (const seg of sorted) {
    const start = seg.fromDate > coveredUntil ? seg.fromDate : coveredUntil;
    const end = seg.toDate < billingEnd ? seg.toDate : billingEnd;
    if (end > start) {
      total += nightsBetween(start, end) * Number(seg.rate);
      coveredUntil = end;
    }
  }
  if (coveredUntil < billingEnd) {
    const lastRate = Number(sorted[sorted.length - 1].rate);
    total += nightsBetween(coveredUntil, billingEnd) * lastRate;
  }
  return total;
}

/** The one place folio arithmetic happens. Comped stays charge nothing but
 *  keep their rate, so accounting can still report the notional value.
 *  Cancelled/no-show bookings never happened, so they charge nothing too —
 *  any reservation fee already paid shows up as a negative balance (money
 *  owed back) instead of being masked by a full-stay charge that was never
 *  earned. What happens to that fee (refund, credit, or forfeit on a
 *  no-show) is a deliberate ADMIN decision made afterward, not baked in here. */
export function folioTotals(b: FolioInput): FolioTotals {
  const charge =
    b.complimentary || b.status === "CANCELLED" || b.status === "NO_SHOW"
      ? 0
      : money(segmentedCharge(b.checkIn, b.billedNights, b.stays));
  let discounts = 0;
  let extraCharges = 0;
  for (const a of b.adjustments) {
    if (a.kind === "DISCOUNT") discounts += money(a.amount);
    else extraCharges += money(a.amount);
  }
  const netTotal = money(charge - discounts + extraCharges);
  const paid = money(b.payments.reduce((s, p) => s + money(p.amount), 0));
  return {
    charge,
    discounts: money(discounts),
    extraCharges: money(extraCharges),
    netTotal,
    paid,
    balance: money(netTotal - paid),
  };
}

/** Notional value of a complimentary stay — what it would have billed. */
export function notionalValue(b: { checkIn: Date; billedNights: number; stays: FolioStaySegment[] }) {
  return money(segmentedCharge(b.checkIn, b.billedNights, b.stays));
}

// ── Period lock ─────────────────────────────────────────────────

export async function lockedThrough(): Promise<Date | null> {
  const settings = await prisma.guesthouseSettings.findUnique({ where: { id: "default" } });
  return settings?.lockedThrough ?? null;
}

/** Guards any edit that would change a filed report. */
export async function assertNotLocked(date: Date, what = "This period"): Promise<void> {
  const through = await lockedThrough();
  if (through && date <= through) {
    throw new ApiError(
      409,
      `${what} falls on or before ${toDateString(through)}, which is closed. Unlock the period to edit it, or record the correction in the current period.`,
    );
  }
}

// ── Availability ────────────────────────────────────────────────

export interface RoomAvailability {
  id: string;
  name: string;
  rate: number;
  capacity: number | null;
  needsCleaning: boolean;
  outOfService: boolean;
  /** Occupied/blocked nights inside the queried window, as date strings. */
  busyNights: string[];
  /** Free for the whole queried range. */
  free: boolean;
  /** Why not, when free is false. */
  conflict: string | null;
}

/**
 * Room-by-room availability across a window. Powers the booking sheet's
 * availability strip; the authoritative check for a write is
 * `assertRoomFree`, which runs inside the insert transaction.
 */
export async function roomAvailability(
  from: Date,
  to: Date,
  opts: { excludeBookingId?: string } = {},
): Promise<RoomAvailability[]> {
  const rooms = await prisma.room.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const [stays, blocks] = await Promise.all([
    prisma.bookingRoomStay.findMany({
      where: {
        fromDate: { lt: to },
        toDate: { gt: from },
        ...(opts.excludeBookingId ? { bookingId: { not: opts.excludeBookingId } } : {}),
        booking: { status: { in: BLOCKING } },
      },
      include: { booking: { select: { guestName: true, status: true } } },
    }),
    prisma.roomBlock.findMany({ where: { fromDate: { lt: to }, toDate: { gt: from } } }),
  ]);

  return rooms.map((room) => {
    const busy = new Set<string>();
    let conflict: string | null = null;

    for (const s of stays.filter((s) => s.roomId === room.id)) {
      for (let d = new Date(Math.max(+s.fromDate, +from)); d < s.toDate && d < to; d = addDays(d, 1)) {
        busy.add(toDateString(d));
      }
      conflict ??= `Booked — ${s.booking.guestName}`;
    }
    for (const b of blocks.filter((b) => b.roomId === room.id)) {
      for (let d = new Date(Math.max(+b.fromDate, +from)); d < b.toDate && d < to; d = addDays(d, 1)) {
        busy.add(toDateString(d));
      }
      conflict ??= `Out of service — ${b.reason}`;
    }
    if (room.outOfService) conflict ??= "Out of service";
    if (room.needsCleaning) conflict ??= "Needs cleaning";

    const free = busy.size === 0 && !room.outOfService && !room.needsCleaning;
    return {
      id: room.id,
      name: room.name,
      rate: money(room.rate),
      capacity: room.capacity,
      needsCleaning: room.needsCleaning,
      outOfService: room.outOfService,
      busyNights: [...busy].sort(),
      free,
      conflict: free ? null : conflict,
    };
  });
}

/**
 * The real double-booking guard. Must be called with the transaction client
 * that also does the insert — two staff on two phones can otherwise both
 * see a room free and both book it.
 */
async function assertRoomFree(
  tx: Prisma.TransactionClient,
  roomId: string,
  from: Date,
  to: Date,
  excludeBookingId?: string,
): Promise<void> {
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room || !room.active) throw new ApiError(404, "Room not found");
  if (room.outOfService) throw new ApiError(409, `${room.name} is out of service`);
  if (room.needsCleaning) throw new ApiError(409, `${room.name} needs cleaning before it can be booked`);

  const clash = await tx.bookingRoomStay.findFirst({
    where: {
      roomId,
      fromDate: { lt: to },
      toDate: { gt: from },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      booking: { status: { in: BLOCKING } },
    },
    include: { booking: { select: { guestName: true } } },
  });
  if (clash) {
    throw new ApiError(
      409,
      `${room.name} is already booked for those dates (${clash.booking.guestName}). Pick another room.`,
    );
  }

  const block = await tx.roomBlock.findFirst({
    where: { roomId, fromDate: { lt: to }, toDate: { gt: from } },
  });
  if (block) throw new ApiError(409, `${room.name} is out of service — ${block.reason}`);
}

// ── Events ──────────────────────────────────────────────────────

async function logEvent(
  tx: Prisma.TransactionClient,
  bookingId: string,
  actorId: string,
  type: BookingEventType,
  opts: { from?: BookingStatus; to?: BookingStatus; detail?: string | null } = {},
) {
  await tx.bookingEvent.create({
    data: {
      bookingId,
      actorId,
      type,
      fromStatus: opts.from ?? null,
      toStatus: opts.to ?? null,
      detail: opts.detail ?? null,
    },
  });
}

// ── Create ──────────────────────────────────────────────────────

export interface CreateBookingInput {
  roomIds: string[]; // more than one = a group booking
  guestName: string;
  contact?: string | null;
  recipientId?: string | null;
  groupName?: string | null;
  checkIn: string;
  checkOut: string;
  occupants?: number;
  note?: string | null;
  /** Tentative hold instead of a firm booking. */
  tentative?: boolean;
  holdUntil?: string | null;
  /** ADMIN only — bills nothing, records notional value. */
  complimentary?: boolean;
  compReason?: string | null;
  /** ADMIN only — walk-in/backdated entry skips the past-date guard. */
  allowPastDates?: boolean;
  /** Create, confirm and check in at once (walk-in). */
  checkInNow?: boolean;
  rateOverride?: number | null;
  /** Cash/GCash/etc. taken on the spot — a reservation fee or deposit,
   *  recorded as a normal Payment so it's deducted from what's owed and
   *  shows in this guest's history. Group bookings apply it to the first
   *  room only; splitting one fee across several rooms isn't supported. */
  advancePayment?: { amount: number; method: PaymentMethod } | null;
}

export async function createBooking(input: CreateBookingInput, actorId: string) {
  const checkIn = dateOnly(input.checkIn);
  const checkOut = dateOnly(input.checkOut);
  const nights = nightsBetween(checkIn, checkOut);

  if (nights < 1) throw new ApiError(422, "Check-out must be at least one night after check-in");
  if (nights > 365) throw new ApiError(422, "A stay cannot exceed 365 nights");
  if (!input.roomIds.length) throw new ApiError(422, "Pick at least one room");
  if (!input.allowPastDates && checkIn < todayInManila()) {
    throw new ApiError(422, "Check-in is in the past. An ADMIN can record a backdated stay.");
  }
  await assertNotLocked(checkIn, "That stay");

  const status: BookingStatus = input.checkInNow
    ? "CHECKED_IN"
    : input.tentative
      ? "PENDING"
      : "CONFIRMED";
  const groupId = input.roomIds.length > 1 ? crypto.randomUUID() : null;

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const [i, roomId] of input.roomIds.entries()) {
      await assertRoomFree(tx, roomId, checkIn, checkOut);
      const room = await tx.room.findUniqueOrThrow({ where: { id: roomId } });

      const booking = await tx.booking.create({
        data: {
          roomId,
          guestName: input.guestName,
          contact: input.contact ?? null,
          recipientId: input.recipientId ?? null,
          groupId,
          groupName: groupId ? (input.groupName ?? input.guestName) : null,
          checkIn,
          checkOut,
          nights,
          billedNights: nights,
          nightlyRate: input.rateOverride ?? room.rate,
          occupants: input.occupants ?? 1,
          status,
          holdUntil: input.tentative && input.holdUntil ? dateOnly(input.holdUntil) : null,
          complimentary: input.complimentary ?? false,
          compReason: input.complimentary ? (input.compReason ?? null) : null,
          note: input.note ?? null,
          actualCheckIn: input.checkInNow ? new Date() : null,
          createdById: actorId,
        },
      });

      await tx.bookingRoomStay.create({
        data: {
          bookingId: booking.id,
          roomId,
          fromDate: checkIn,
          toDate: checkOut,
          rate: input.rateOverride ?? room.rate,
        },
      });

      await logEvent(tx, booking.id, actorId, "CREATED", {
        to: status,
        detail: input.checkInNow
          ? "Walk-in — created and checked in"
          : input.allowPastDates && checkIn < todayInManila()
            ? "Backdated entry"
            : null,
      });
      if (input.complimentary) {
        await logEvent(tx, booking.id, actorId, "COMPED", {
          detail: input.compReason ?? "Complimentary stay",
        });
      }
      if (i === 0 && input.advancePayment) {
        const amount = Math.round(input.advancePayment.amount * 100) / 100;
        const charge = money(nights * (input.rateOverride ?? Number(room.rate)));
        if (amount > charge) {
          throw new ApiError(422, `That is more than the ₱${charge.toFixed(2)} charge for this stay`);
        }
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount,
            method: input.advancePayment.method,
            note: "Advance payment / reservation fee",
            recordedById: actorId,
          },
        });
        await logEvent(tx, booking.id, actorId, "PAYMENT_RECORDED", {
          detail: `₱${amount.toFixed(2)} · ${input.advancePayment.method.replace(/_/g, " ").toLowerCase()} (advance)`,
        });
      }
      created.push(booking);
    }
    return created;
  }, TX_OPTS);
}

// ── Lifecycle ───────────────────────────────────────────────────

function assertTransition(from: BookingStatus, to: BookingStatus) {
  if (!TRANSITIONS[from].includes(to)) {
    throw new ApiError(409, `A ${from.toLowerCase().replace("_", " ")} booking cannot become ${to.toLowerCase().replace("_", " ")}`);
  }
}

export async function confirmBooking(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    assertTransition(booking.status, "CONFIRMED");
    const updated = await tx.booking.update({
      where: { id },
      data: { status: "CONFIRMED", holdUntil: null },
    });
    await logEvent(tx, id, actorId, "CONFIRMED", { from: booking.status, to: "CONFIRMED" });
    return updated;
  }, TX_OPTS);
}

export async function checkInBooking(
  id: string,
  actorId: string,
  opts: { actualOccupants?: number } = {},
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    assertTransition(booking.status, "CHECKED_IN");
    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: "CHECKED_IN",
        actualCheckIn: new Date(),
        ...(opts.actualOccupants ? { actualOccupants: opts.actualOccupants } : {}),
      },
    });
    await logEvent(tx, id, actorId, "CHECKED_IN", { from: booking.status, to: "CHECKED_IN" });
    if (opts.actualOccupants && opts.actualOccupants !== booking.occupants) {
      await logEvent(tx, id, actorId, "OCCUPANTS_CHANGED", {
        detail: `Booked for ${booking.occupants} → arrived ${opts.actualOccupants}`,
      });
    }
    return updated;
  }, TX_OPTS);
}

/** Flag-only correction — booked headcount vs who actually showed up. No
 *  price impact; there's no per-person rate to compute a surcharge from. */
export async function setActualOccupants(id: string, actorId: string, actualOccupants: number) {
  if (actualOccupants < 1) throw new ApiError(422, "Occupant count must be at least 1");
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    const updated = await tx.booking.update({ where: { id }, data: { actualOccupants } });
    if (actualOccupants !== booking.occupants) {
      await logEvent(tx, id, actorId, "OCCUPANTS_CHANGED", {
        detail: `Booked for ${booking.occupants} → arrived ${actualOccupants}`,
      });
    }
    return updated;
  }, TX_OPTS);
}

/**
 * Check out, settling how many nights to actually bill. An early departure
 * truncates the stay row so the unused nights free up immediately, and
 * leaves `nights` (the reservation of record) untouched.
 */
export async function checkOutBooking(
  id: string,
  actorId: string,
  opts: { billedNights?: number } = {},
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    assertTransition(booking.status, "CHECKED_OUT");

    const today = todayInManila();
    const stayedNights = Math.max(1, Math.min(booking.nights, nightsBetween(booking.checkIn, today)));
    const billedNights = opts.billedNights ?? stayedNights;
    if (billedNights < 1 || billedNights > booking.nights) {
      throw new ApiError(422, `Billed nights must be between 1 and ${booking.nights}`);
    }

    // Free the unused tail of an early departure.
    const actualEnd = addDays(booking.checkIn, billedNights);
    if (actualEnd < booking.checkOut) {
      const last = await tx.bookingRoomStay.findFirst({
        where: { bookingId: id },
        orderBy: { fromDate: "desc" },
      });
      if (last && last.toDate > actualEnd) {
        await tx.bookingRoomStay.update({
          where: { id: last.id },
          data: { toDate: actualEnd > last.fromDate ? actualEnd : addDays(last.fromDate, 1) },
        });
      }
    }

    const updated = await tx.booking.update({
      where: { id },
      data: { status: "CHECKED_OUT", actualCheckOut: new Date(), billedNights },
    });
    await tx.room.update({ where: { id: booking.roomId }, data: { needsCleaning: true } });

    await logEvent(tx, id, actorId, "CHECKED_OUT", {
      from: booking.status,
      to: "CHECKED_OUT",
      detail:
        billedNights !== booking.nights
          ? `Early checkout — booked ${booking.nights} night(s), billed ${billedNights}`
          : null,
    });
    return updated;
  }, TX_OPTS);
}

export async function cancelBooking(id: string, actorId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    assertTransition(booking.status, "CANCELLED");
    // Cancelling zeroes the charge (see folioTotals), so any reservation fee
    // already paid just becomes a negative balance — refund it or credit the
    // guest afterward with the same buttons used everywhere else. No need
    // to force that decision before the booking can even be cancelled.
    const updated = await tx.booking.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason },
    });
    // Stay rows stay for audit; BLOCKING excludes CANCELLED (and CHECKED_OUT),
    // so the room frees immediately.
    await logEvent(tx, id, actorId, "CANCELLED", {
      from: booking.status,
      to: "CANCELLED",
      detail: reason,
    });
    return updated;
  }, TX_OPTS);
}

export async function markNoShow(id: string, actorId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    assertTransition(booking.status, "NO_SHOW");
    const updated = await tx.booking.update({
      where: { id },
      data: { status: "NO_SHOW", cancelReason: reason ?? "Did not arrive" },
    });
    await logEvent(tx, id, actorId, "NO_SHOW", { from: booking.status, to: "NO_SHOW" });
    return updated;
  }, TX_OPTS);
}

// ── Changes to a live booking ───────────────────────────────────

/** Extend (or shorten, before check-in) a stay by moving the check-out date. */
export async function changeDates(
  id: string,
  actorId: string,
  next: { checkIn?: string; checkOut: string },
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED" && booking.status !== "CHECKED_IN") {
      throw new ApiError(409, "Only an upcoming or in-house booking can have its dates changed");
    }
    const checkIn = next.checkIn ? dateOnly(next.checkIn) : booking.checkIn;
    const checkOut = dateOnly(next.checkOut);
    if (booking.status === "CHECKED_IN" && +checkIn !== +booking.checkIn) {
      throw new ApiError(409, "The guest has already checked in — the arrival date cannot change");
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1) throw new ApiError(422, "Check-out must be at least one night after check-in");
    await assertNotLocked(checkIn, "That stay");
    await assertRoomFree(tx, booking.roomId, checkIn, checkOut, id);

    // One stay row is the normal case; a moved booking keeps its history and
    // only its current (last) row is re-dated.
    const stays = await tx.bookingRoomStay.findMany({
      where: { bookingId: id },
      orderBy: { fromDate: "asc" },
    });
    const first = stays[0];
    const last = stays[stays.length - 1];
    if (first) await tx.bookingRoomStay.update({ where: { id: first.id }, data: { fromDate: checkIn } });
    if (last) await tx.bookingRoomStay.update({ where: { id: last.id }, data: { toDate: checkOut } });

    const extended = nights > booking.nights;
    const updated = await tx.booking.update({
      where: { id },
      data: { checkIn, checkOut, nights, billedNights: nights },
    });
    await logEvent(tx, id, actorId, extended ? "EXTENDED" : "DATES_CHANGED", {
      detail: `${booking.nights} night(s) → ${nights} night(s) (${toDateString(checkIn)} → ${toDateString(checkOut)})`,
    });
    return updated;
  }, TX_OPTS);
}

/**
 * Move a guest to another room mid-stay. The original stay row is closed at
 * the move date and a new one opens, so occupancy history stays truthful and
 * the vacated nights free up. The new segment snapshots the target room's
 * own rate, so nights after the move bill at that room's price — a move to
 * a cheaper or pricier room actually changes what's charged, no separate
 * discount/charge needed for that difference.
 */
export async function changeRoom(id: string, actorId: string, roomId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id }, include: { room: true } });
    if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status)) {
      throw new ApiError(409, "Only an upcoming or in-house booking can change room");
    }
    if (roomId === booking.roomId) throw new ApiError(422, "That is already the assigned room");

    const today = todayInManila();
    // Before arrival the whole stay moves; mid-stay it splits at today.
    const moveFrom =
      booking.status === "CHECKED_IN" && today > booking.checkIn && today < booking.checkOut
        ? today
        : booking.checkIn;

    await assertRoomFree(tx, roomId, moveFrom, booking.checkOut, id);
    const target = await tx.room.findUniqueOrThrow({ where: { id: roomId } });

    const last = await tx.bookingRoomStay.findFirst({
      where: { bookingId: id },
      orderBy: { fromDate: "desc" },
    });
    const wholeStayMoves = last && +moveFrom <= +last.fromDate;
    if (last && !wholeStayMoves) {
      await tx.bookingRoomStay.update({ where: { id: last.id }, data: { toDate: moveFrom } });
      await tx.bookingRoomStay.create({
        data: {
          bookingId: id,
          roomId,
          fromDate: moveFrom,
          toDate: booking.checkOut,
          reason,
          rate: target.rate,
        },
      });
    } else if (last) {
      await tx.bookingRoomStay.update({
        where: { id: last.id },
        data: { roomId, reason, rate: target.rate },
      });
    }

    if (booking.status === "CHECKED_IN") {
      await tx.room.update({ where: { id: booking.roomId }, data: { needsCleaning: true } });
    }
    // Before arrival the booking hasn't billed anything yet, so its
    // headline rate follows the room too, staying representative in list
    // views. Mid-stay it's left alone — it still reflects the first segment.
    const updated = await tx.booking.update({
      where: { id },
      data: wholeStayMoves ? { roomId, nightlyRate: target.rate } : { roomId },
    });
    await logEvent(tx, id, actorId, "ROOM_CHANGED", {
      detail: `${booking.room.name} → ${target.name}${moveFrom > booking.checkIn ? ` from ${toDateString(moveFrom)}` : ""} · ${reason}`,
    });
    return updated;
  }, TX_OPTS);
}

/**
 * ADMIN correction after checkout — "booked 4 nights, actually stayed 2".
 * Re-bills without touching `nights`, and can leave a refund owing, which
 * the accounting page surfaces rather than hiding as a negative balance.
 */
export async function adjustBilledNights(
  id: string,
  actorId: string,
  billedNights: number,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id } });
    if (booking.status !== "CHECKED_OUT") {
      throw new ApiError(409, "Only a checked-out stay can have its billed nights corrected");
    }
    if (billedNights < 1 || billedNights > booking.nights) {
      throw new ApiError(422, `Billed nights must be between 1 and ${booking.nights}`);
    }
    await assertNotLocked(booking.checkIn, "That stay");
    if (billedNights === booking.billedNights) throw new ApiError(422, "That is already the billed count");

    const updated = await tx.booking.update({ where: { id }, data: { billedNights } });
    await logEvent(tx, id, actorId, "NIGHTS_ADJUSTED", {
      detail: `Billed nights ${booking.billedNights} → ${billedNights} · ${reason}`,
    });
    return updated;
  }, TX_OPTS);
}

// ── Money ───────────────────────────────────────────────────────

export interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  payerId?: string | null;
  orNumber?: string | null;
  reference?: string | null;
  note?: string | null;
  paidAt?: string | null;
}

/**
 * Settlement of an existing booking — at or after checkout — or a refund
 * (negative amount) on any booking that still has money owed back, which
 * includes a cancelled/no-show stay's reservation fee (its charge is zeroed,
 * see folioTotals, so the fee sits as a negative balance until refunded or
 * credited). An advance payment/reservation fee taken at booking time goes
 * through `createBooking` instead, since front desk can take that but not
 * this. A negative amount is a refund and is gated on guesthouse.adjust by
 * the route.
 */
export async function recordPayment(id: string, actorId: string, input: RecordPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id },
      include: { payments: true, adjustments: true, stays: true },
    });
    if (booking.complimentary) {
      throw new ApiError(409, "This is a complimentary stay — there is nothing to settle");
    }
    const amountIsRefund = input.amount < 0;
    const canSettle = booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT";
    const canRefund = canSettle || booking.status === "CANCELLED" || booking.status === "NO_SHOW";
    if (amountIsRefund ? !canRefund : !canSettle) {
      throw new ApiError(409, "A stay can only be settled at or after checkout");
    }
    await assertNotLocked(booking.checkIn, "That stay");

    const amount = Math.round(input.amount * 100) / 100;
    if (amount === 0) throw new ApiError(422, "Amount cannot be zero");

    const totals = folioTotals(booking);
    if (amount > 0 && amount > totals.balance) {
      throw new ApiError(
        422,
        `That is more than the ₱${totals.balance.toFixed(2)} outstanding on this stay`,
      );
    }
    if (amount < 0 && Math.abs(amount) > totals.paid) {
      throw new ApiError(422, "A refund cannot exceed what was paid");
    }
    if (input.method === "CHARGE_TO_DEPARTMENT" && !input.payerId) {
      throw new ApiError(422, "Pick the department or district being charged");
    }
    if (input.method === "CREDIT") {
      if (amount < 0) throw new ApiError(422, "A credit refund is a plain refund, not a credit payment");
      if (!booking.recipientId) {
        throw new ApiError(422, "This booking isn't linked to a guest — there is no credit to apply");
      }
      const available = await guestCreditBalance(booking.recipientId, tx);
      if (amount > available) {
        throw new ApiError(422, `That guest only has ₱${available.toFixed(2)} credit available`);
      }
    }

    const payment = await tx.payment.create({
      data: {
        bookingId: id,
        amount,
        method: input.method,
        payerId: input.method === "CHARGE_TO_DEPARTMENT" ? input.payerId : null,
        orNumber: input.orNumber ?? null,
        reference: input.reference ?? null,
        note: input.note ?? null,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        recordedById: actorId,
      },
    });
    if (input.method === "CREDIT") {
      await tx.guestCredit.create({
        data: {
          recipientId: booking.recipientId!,
          amount: -amount,
          reason: "Applied to booking",
          usedBookingId: id,
          recordedById: actorId,
        },
      });
      await logEvent(tx, id, actorId, "CREDIT_APPLIED", {
        detail: `₱${amount.toFixed(2)} credit applied`,
      });
    } else {
      await logEvent(tx, id, actorId, amount < 0 ? "REFUND_RECORDED" : "PAYMENT_RECORDED", {
        detail: `₱${Math.abs(amount).toFixed(2)} · ${input.method.replace(/_/g, " ").toLowerCase()}`,
      });
    }
    return payment;
  }, TX_OPTS);
}

/**
 * ADMIN-only folio adjustment. A discount may only be applied *before* any
 * payment exists — otherwise it would create money owed back, which is a
 * refund decision, not a pricing one.
 */
export async function recordAdjustment(
  id: string,
  actorId: string,
  input: { kind: AdjustmentKind; amount: number; reason: string },
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id },
      include: { payments: true, adjustments: true, stays: true },
    });
    if (booking.complimentary) {
      throw new ApiError(409, "This is a complimentary stay — it bills nothing to adjust");
    }
    if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
      throw new ApiError(409, "That booking never happened — there is nothing to adjust");
    }
    await assertNotLocked(booking.checkIn, "That stay");

    const amount = Math.round(input.amount * 100) / 100;
    if (amount <= 0) throw new ApiError(422, "Amount must be greater than zero");

    const totals = folioTotals(booking);
    if (input.kind === "DISCOUNT") {
      if (booking.payments.length > 0) {
        throw new ApiError(
          409,
          "This stay is already settled — a discount has to be applied before payment.",
        );
      }
      if (amount > totals.netTotal) {
        throw new ApiError(422, `A discount cannot exceed the ₱${totals.netTotal.toFixed(2)} charge`);
      }
    }

    const adjustment = await tx.folioAdjustment.create({
      data: { bookingId: id, kind: input.kind, amount, reason: input.reason, createdById: actorId },
    });
    await logEvent(tx, id, actorId, input.kind === "DISCOUNT" ? "DISCOUNT_APPLIED" : "CHARGE_ADDED", {
      detail: `₱${amount.toFixed(2)} · ${input.reason}`,
    });
    return adjustment;
  }, TX_OPTS);
}

/**
 * A no-show's reservation fee, kept instead of refunded or credited — the
 * default "paid to hold the room, didn't show up" penalty. Posts a CHARGE
 * adjustment for exactly the outstanding amount so the balance goes to zero
 * and the ledger records why. This is one option alongside "Record refund"
 * and "Credit to guest" for the same negative balance — ADMIN picks
 * whichever fits, nothing forfeits automatically.
 */
export async function forfeitPayment(bookingId: string, actorId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { payments: true, adjustments: true, stays: true },
    });
    if (booking.status !== "NO_SHOW") {
      throw new ApiError(409, "Only a no-show's reservation fee can be forfeited");
    }
    const totals = folioTotals(booking);
    if (totals.balance >= 0) throw new ApiError(422, "There is nothing paid to forfeit");
    const amount = Math.abs(totals.balance);

    const adjustment = await tx.folioAdjustment.create({
      data: { bookingId, kind: "CHARGE", amount, reason, createdById: actorId },
    });
    await logEvent(tx, bookingId, actorId, "CHARGE_ADDED", {
      detail: `₱${amount.toFixed(2)} reservation fee forfeited · ${reason}`,
    });
    return adjustment;
  }, TX_OPTS);
}

// ── Guest credit ────────────────────────────────────────────────

/** Sum of a recipient's credit ledger — positive rows earned, negative spent. */
export async function guestCreditBalance(
  recipientId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const agg = await tx.guestCredit.aggregate({ where: { recipientId }, _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

/**
 * Converts an overpayment into guest credit instead of a cash refund — an
 * alternative to `recordPayment`'s negative-amount refund, not a replacement
 * for it (ADMIN picks whichever fits at checkout). Only possible once the
 * booking is linked to a GUESTHOUSE recipient, since credit is tracked
 * per-guest, not per-booking — e.g. paid for 3 nights, stayed 2: the unused
 * night's value can sit as credit until the guest's next visit instead of
 * being handed back as cash.
 */
export async function issueGuestCredit(
  bookingId: string,
  actorId: string,
  input: { amount: number; reason: string },
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { payments: true, adjustments: true, stays: true },
    });
    if (!booking.recipientId) {
      throw new ApiError(422, "Link this booking to a guest before crediting an overpayment");
    }
    const amount = Math.round(input.amount * 100) / 100;
    if (amount <= 0) throw new ApiError(422, "Amount must be greater than zero");
    const totals = folioTotals(booking);
    if (totals.balance >= 0 || amount > Math.abs(totals.balance)) {
      throw new ApiError(422, "That is more than the overpayment on this stay");
    }

    const credit = await tx.guestCredit.create({
      data: {
        recipientId: booking.recipientId,
        amount,
        reason: input.reason,
        sourceBookingId: bookingId,
        recordedById: actorId,
      },
    });
    await logEvent(tx, bookingId, actorId, "CREDIT_ISSUED", {
      detail: `₱${amount.toFixed(2)} credited to guest instead of refunded · ${input.reason}`,
    });
    return credit;
  }, TX_OPTS);
}

/** Mark charged-to-department stays as paid by the department, in one batch. */
export async function settleReceivables(paymentIds: string[], actorId: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.payment.findMany({
      where: { id: { in: paymentIds }, method: "CHARGE_TO_DEPARTMENT", settledAt: null },
    });
    if (!rows.length) throw new ApiError(404, "Nothing outstanding to settle");
    const now = new Date();
    await tx.payment.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { settledAt: now },
    });
    for (const r of rows) {
      await logEvent(tx, r.bookingId, actorId, "RECEIVABLE_SETTLED", {
        detail: `₱${Number(r.amount).toFixed(2)} settled by department`,
      });
    }
    return rows.length;
  }, TX_OPTS);
}

// ── Room status (derived) ───────────────────────────────────────

export type DerivedRoomStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";

export function deriveRoomStatus(
  room: { outOfService: boolean },
  opts: { occupied: boolean; blocked: boolean },
): DerivedRoomStatus {
  if (room.outOfService || opts.blocked) return "MAINTENANCE";
  return opts.occupied ? "OCCUPIED" : "AVAILABLE";
}

/**
 * The room board for a given day, with status derived from who is actually
 * in the room. Shared by the rooms endpoint and the Today board so the two
 * can never disagree.
 */
export async function roomBoard(day: Date = todayInManila()) {
  const next = addDays(day, 1);
  const [rooms, stays, blocks] = await Promise.all([
    prisma.room.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.bookingRoomStay.findMany({
      where: { fromDate: { lte: day }, toDate: { gt: day }, booking: { status: "CHECKED_IN" } },
      include: { booking: { select: { id: true, guestName: true, checkOut: true } } },
    }),
    prisma.roomBlock.findMany({ where: { fromDate: { lt: next }, toDate: { gt: day } } }),
  ]);

  return rooms.map((room) => {
    const stay = stays.find((s) => s.roomId === room.id);
    const roomBlocks = blocks.filter((b) => b.roomId === room.id);
    return {
      id: room.id,
      name: room.name,
      rate: money(room.rate),
      ...(room.capacity ? { capacity: room.capacity } : {}),
      ...(room.notes ? { notes: room.notes } : {}),
      outOfService: room.outOfService,
      needsCleaning: room.needsCleaning,
      status: deriveRoomStatus(room, { occupied: !!stay, blocked: roomBlocks.length > 0 }),
      ...(stay
        ? {
            guestName: stay.booking.guestName,
            until: toDateString(stay.booking.checkOut),
            bookingId: stay.booking.id,
          }
        : {}),
      blocks: roomBlocks.map((b) => ({
        id: b.id,
        from: toDateString(b.fromDate),
        to: toDateString(b.toDate),
        reason: b.reason,
      })),
    };
  });
}
