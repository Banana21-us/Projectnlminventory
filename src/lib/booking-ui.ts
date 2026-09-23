import type { Booking } from "./types";

/** "Room 1 → Room 3" / "3 → 8 pax" — surfaced wherever a booking is shown. */
export function bookingNotes(booking: Booking): string[] {
  const notes: string[] = [];
  if (booking.stayRooms && booking.stayRooms.length > 1) {
    notes.push(booking.stayRooms.join(" → "));
  }
  if (booking.actualOccupants && booking.actualOccupants !== booking.occupants) {
    notes.push(`${booking.occupants} → ${booking.actualOccupants} pax`);
  }
  return notes;
}

function addDaysStr(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function nightsBetweenStr(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Client-side mirror of the server's segmented charge — lets the checkout
 * and adjust-nights panels preview the real total (room-by-room rate) as
 * the user edits billed nights, instead of a flat nightlyRate estimate that
 * would be wrong once the stay has moved rooms.
 */
export function previewCharge(booking: Booking, billedNights: number): number {
  if (booking.complimentary || billedNights <= 0) return 0;
  const stays = booking.stays;
  if (!stays || stays.length === 0) return booking.nightlyRate * billedNights;

  const billingEnd = addDaysStr(booking.checkIn, billedNights);
  const sorted = [...stays].sort((a, b) => a.from.localeCompare(b.from));
  let total = 0;
  let coveredUntil = booking.checkIn;
  for (const seg of sorted) {
    const start = seg.from > coveredUntil ? seg.from : coveredUntil;
    const end = seg.to < billingEnd ? seg.to : billingEnd;
    if (end > start) {
      total += nightsBetweenStr(start, end) * seg.rate;
      coveredUntil = end;
    }
  }
  if (coveredUntil < billingEnd) {
    total += nightsBetweenStr(coveredUntil, billingEnd) * sorted[sorted.length - 1].rate;
  }
  return Math.round(total * 100) / 100;
}
