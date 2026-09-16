import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateString } from "@/lib/booking";
import { roomBlockSchema } from "@/lib/validators";

/**
 * POST /api/guesthouse/blocks — hold a room out of service for a date range.
 *
 * Dated blocks expire on their own; an indefinite closure is Room.outOfService
 * instead. Confirmed bookings inside the range are reported back rather than
 * silently stranded — the caller decides whether to move or cancel them.
 */
export const POST = api(async (request) => {
  const user = await requireCan("guesthouse.rooms");
  const data = await validate(request, roomBlockSchema);

  const fromDate = dateOnly(data.fromDate);
  const toDate = dateOnly(data.toDate);

  const room = await prisma.room.findUnique({ where: { id: data.roomId } });
  if (!room) throw new ApiError(404, "Room not found");

  const clashes = await prisma.bookingRoomStay.findMany({
    where: {
      roomId: data.roomId,
      fromDate: { lt: toDate },
      toDate: { gt: fromDate },
      booking: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } },
    },
    include: { booking: { select: { id: true, guestName: true, checkIn: true, checkOut: true } } },
  });

  const block = await prisma.roomBlock.create({
    data: {
      roomId: data.roomId,
      fromDate,
      toDate,
      reason: data.reason,
      createdById: user.id,
    },
  });

  return Response.json(
    {
      id: block.id,
      // The UI warns on these; the block still applies to *new* bookings.
      affected: clashes.map((c) => ({
        bookingId: c.booking.id,
        guestName: c.booking.guestName,
        checkIn: toDateString(c.booking.checkIn),
        checkOut: toDateString(c.booking.checkOut),
      })),
    },
    { status: 201 },
  );
});

/** DELETE /api/guesthouse/blocks?id= — lift a block early. */
export const DELETE = api(async (request) => {
  await requireCan("guesthouse.rooms");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new ApiError(422, "Block id is required");

  const block = await prisma.roomBlock.findUnique({ where: { id } });
  if (!block) throw new ApiError(404, "Block not found");

  await prisma.roomBlock.delete({ where: { id } });
  return Response.json({ ok: true });
});
