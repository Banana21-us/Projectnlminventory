import { api, requireCan, requireUser, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { roomUpdateSchema } from "@/lib/validators";
import { can } from "@/lib/policies";

/**
 * PATCH /api/guesthouse/rooms/[id]
 *
 * Room setup (name, rate, capacity, out-of-service) is ADMIN-only, but the
 * housekeeping flag is front-desk work — whoever cleans the room clears it.
 */
export const PATCH = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const data = await validate(request, roomUpdateSchema);

  const housekeepingOnly =
    Object.keys(data).length === 1 && data.needsCleaning !== undefined;
  if (!housekeepingOnly && !can(user.role, "guesthouse.rooms")) {
    throw new ApiError(403, "Not permitted");
  }
  if (housekeepingOnly && !can(user.role, "guesthouse.manage")) {
    throw new ApiError(403, "Not permitted");
  }

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new ApiError(404, "Room not found");

  await prisma.room.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.rate !== undefined ? { rate: data.rate } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.outOfService !== undefined ? { outOfService: data.outOfService } : {}),
      ...(data.needsCleaning !== undefined ? { needsCleaning: data.needsCleaning } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
  return Response.json({ ok: true });
});

/**
 * DELETE /api/guesthouse/rooms/[id] — deactivates rather than destroys once
 * the room has history, so past stays keep their room name.
 */
export const DELETE = api(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  await requireCan("guesthouse.rooms");
  const { id } = await params;

  const room = await prisma.room.findUnique({
    where: { id },
    include: { _count: { select: { bookings: true } } },
  });
  if (!room) throw new ApiError(404, "Room not found");

  if (room._count.bookings > 0) {
    await prisma.room.update({ where: { id }, data: { active: false } });
    return Response.json({ ok: true, deactivated: true });
  }
  await prisma.room.delete({ where: { id } });
  return Response.json({ ok: true, deactivated: false });
});
