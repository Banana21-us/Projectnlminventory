import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createBooking, dateOnly } from "@/lib/booking";
import { BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import { bookingCreateSchema } from "@/lib/validators";
import { can } from "@/lib/policies";
import type { BookingStatus, Prisma } from "@prisma/client";

const STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

/** GET /api/guesthouse/bookings?status=&from=&to=&q=&limit= */
export const GET = api(async (request) => {
  await requireCan("guesthouse.view");
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  const where: Prisma.BookingWhereInput = {
    ...(status && STATUSES.includes(status as BookingStatus)
      ? { status: status as BookingStatus }
      : {}),
    // A stay matches a window if it overlaps it, not if it starts inside it.
    ...(from ? { checkOut: { gt: dateOnly(from) } } : {}),
    ...(to ? { checkIn: { lt: dateOnly(to) } } : {}),
    ...(q
      ? {
          OR: [
            { guestName: { contains: q, mode: "insensitive" } },
            { contact: { contains: q, mode: "insensitive" } },
            { groupName: { contains: q, mode: "insensitive" } },
            { room: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.booking.findMany({
    where,
    include: BOOKING_INCLUDE,
    orderBy: [{ checkIn: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return Response.json(rows.map((r) => toBookingDto(r)));
});

/**
 * POST /api/guesthouse/bookings — one room, or several in a group booking.
 *
 * Front desk can book, check in a walk-in, and place a tentative hold. The
 * options that move money (complimentary, rate override) or rewrite history
 * (backdating) are ADMIN-only.
 */
export const POST = api(async (request) => {
  const user = await requireCan("guesthouse.manage");
  const data = await validate(request, bookingCreateSchema);

  const privileged = data.complimentary || data.allowPastDates || data.rateOverride !== undefined;
  if (privileged && !can(user.role, "guesthouse.adjust")) {
    throw new ApiError(
      403,
      "Complimentary stays, rate overrides and backdated entries are ADMIN-only",
    );
  }

  const bookings = await createBooking(
    {
      roomIds: data.roomIds,
      guestName: data.guestName,
      contact: data.contact ?? null,
      recipientId: data.recipientId ?? null,
      groupName: data.groupName ?? null,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      occupants: data.occupants,
      note: data.note ?? null,
      tentative: data.tentative,
      holdUntil: data.holdUntil ?? null,
      complimentary: data.complimentary,
      compReason: data.compReason ?? null,
      allowPastDates: data.allowPastDates,
      checkInNow: data.checkInNow,
      rateOverride: data.rateOverride ?? null,
    },
    user.id,
  );

  return Response.json(
    { ids: bookings.map((b) => b.id), groupId: bookings[0]?.groupId ?? null },
    { status: 201 },
  );
});
