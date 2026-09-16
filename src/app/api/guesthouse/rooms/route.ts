import { api, requireCan, validate } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { dateOnly, roomAvailability, roomBoard } from "@/lib/booking";
import { roomCreateSchema } from "@/lib/validators";

/**
 * GET /api/guesthouse/rooms
 *   ?from=&to=  → availability across that window (the booking sheet strip)
 *   otherwise   → today's room board, status derived from stays + blocks
 */
export const GET = api(async (request) => {
  await requireCan("guesthouse.view");
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (from && to) {
    const excludeBookingId = url.searchParams.get("excludeBookingId") ?? undefined;
    return Response.json(await roomAvailability(dateOnly(from), dateOnly(to), { excludeBookingId }));
  }
  return Response.json(await roomBoard());
});

/** POST /api/guesthouse/rooms — room setup is ADMIN-only. */
export const POST = api(async (request) => {
  await requireCan("guesthouse.rooms");
  const data = await validate(request, roomCreateSchema);

  const room = await prisma.room.create({
    data: {
      name: data.name,
      rate: data.rate,
      capacity: data.capacity ?? null,
      notes: data.notes || null,
    },
  });
  return Response.json({ id: room.id }, { status: 201 });
});
