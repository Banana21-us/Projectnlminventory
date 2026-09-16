import { api, requireCan } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { roomBoard, todayInManila, toDateString } from "@/lib/booking";
import { BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import type { TodayBoard } from "@/lib/types";

/**
 * GET /api/guesthouse/today — the front desk's whole day in one payload.
 *
 * "Today" is Manila's today, not the server's: on Vercel the two are eight
 * hours apart and an arrivals list that flips at 8am would be useless.
 */
export const GET = api(async () => {
  await requireCan("guesthouse.view");
  const today = todayInManila();

  const [arriving, inHouseRows, holds, rooms] = await Promise.all([
    // Due to arrive today, plus anyone confirmed who never turned up.
    prisma.booking.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED"] }, checkIn: { lte: today } },
      include: BOOKING_INCLUDE,
      orderBy: { checkIn: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: "CHECKED_IN" },
      include: BOOKING_INCLUDE,
      orderBy: { checkOut: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: "PENDING", holdUntil: { lt: today } },
      include: BOOKING_INCLUDE,
      orderBy: { holdUntil: "asc" },
    }),
    roomBoard(today),
  ]);

  const arrivals = arriving.filter((b) => +b.checkIn === +today).map((b) => toBookingDto(b));
  // A confirmed booking whose arrival date has passed is flagged, never
  // auto-transitioned — an 11pm arrival must not be marked a no-show.
  const didNotArrive = arriving
    .filter((b) => +b.checkIn < +today && b.status === "CONFIRMED")
    .map((b) => toBookingDto(b));
  const departures = inHouseRows.filter((b) => +b.checkOut <= +today).map((b) => toBookingDto(b));
  const inHouse = inHouseRows.filter((b) => +b.checkOut > +today).map((b) => toBookingDto(b));

  const board: TodayBoard = {
    date: toDateString(today),
    counts: {
      arrivals: arrivals.length,
      departures: departures.length,
      inHouse: inHouseRows.length,
      free: rooms.filter((r) => r.status === "AVAILABLE").length,
      needsCleaning: rooms.filter((r) => r.needsCleaning).length,
    },
    arrivals,
    departures,
    inHouse,
    didNotArrive,
    expiredHolds: holds.map((b) => toBookingDto(b)),
    rooms,
  };
  return Response.json(board);
});
