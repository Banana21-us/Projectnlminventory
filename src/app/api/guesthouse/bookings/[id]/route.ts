import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  adjustBilledNights,
  cancelBooking,
  changeDates,
  changeRoom,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  markNoShow,
} from "@/lib/booking";
import { BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import { bookingActionSchema } from "@/lib/validators";

/** GET /api/guesthouse/bookings/[id] — folio, ledgers and audit trail. */
export const GET = api(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  await requireCan("guesthouse.view");
  const { id } = await params;

  const row = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  if (!row) throw new ApiError(404, "Booking not found");
  return Response.json(toBookingDto(row, { detail: true }));
});

/**
 * PATCH /api/guesthouse/bookings/[id] — every lifecycle move.
 *
 * The transitions themselves are front-desk work; correcting billed nights
 * after checkout changes what was charged, so it needs guesthouse.adjust.
 */
export const PATCH = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireCan("guesthouse.manage");
  const { id } = await params;
  const data = await validate(request, bookingActionSchema);

  switch (data.action) {
    case "confirm":
      await confirmBooking(id, user.id);
      break;
    case "checkIn":
      await checkInBooking(id, user.id);
      break;
    case "checkOut":
      await checkOutBooking(id, user.id, { billedNights: data.billedNights });
      break;
    case "cancel":
      await cancelBooking(id, user.id, data.reason);
      break;
    case "noShow":
      await markNoShow(id, user.id, data.reason);
      break;
    case "changeDates":
      await changeDates(id, user.id, { checkIn: data.checkIn, checkOut: data.checkOut });
      break;
    case "changeRoom":
      await changeRoom(id, user.id, data.roomId, data.reason);
      break;
    case "adjustNights":
      await requireCan("guesthouse.adjust");
      await adjustBilledNights(id, user.id, data.billedNights, data.reason);
      break;
  }

  const row = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  if (!row) throw new ApiError(404, "Booking not found");
  return Response.json(toBookingDto(row, { detail: true }));
});
