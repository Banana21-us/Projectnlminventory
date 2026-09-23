import { api, requireCan, validate } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { toRecipientDto } from "@/lib/dto";
import { guestCreateSchema } from "@/lib/validators";
import type { GuestDto } from "@/lib/types";

/**
 * GET /api/guesthouse/guests?search=&list=1
 *
 * With `search`, a lean name-suggestion source for the booking sheet's guest
 * field (kept separate from /api/recipients so front desk, guesthouse.view,
 * never needs access to pastor/department data). With `list=1`, the full
 * roster for the Guests tab, each with their visit count, last stay and
 * current credit balance.
 *
 * RecipientType.GUESTHOUSE is also used by inventory dispensing (e.g. a
 * generic "Guesthouse" recipient stock is issued to) — that's a different
 * thing from an actual guest who stayed here. `bookings: { some: {} }`
 * excludes anyone who's never actually been booked, so those generic rows
 * never show up as a "guest" with 0 visits.
 */
export const GET = api(async (request) => {
  await requireCan("guesthouse.view");
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();
  const list = url.searchParams.get("list") === "1";

  const guests = await prisma.recipient.findMany({
    where: {
      type: "GUESTHOUSE",
      active: true,
      bookings: { some: {} },
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { district: true },
    orderBy: { name: "asc" },
    ...(list ? {} : { take: 8 }),
  });
  if (!list) return Response.json(guests.map(toRecipientDto));

  const ids = guests.map((g) => g.id);
  const [creditAgg, bookingAgg] = await Promise.all([
    prisma.guestCredit.groupBy({ by: ["recipientId"], where: { recipientId: { in: ids } }, _sum: { amount: true } }),
    prisma.booking.groupBy({
      by: ["recipientId"],
      where: { recipientId: { in: ids }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      _count: { _all: true },
      _max: { checkOut: true },
    }),
  ]);
  const creditByGuest = new Map(creditAgg.map((c) => [c.recipientId, Number(c._sum.amount ?? 0)]));
  const bookingByGuest = new Map(
    bookingAgg.map((b) => [b.recipientId, { visits: b._count._all, lastStay: b._max.checkOut }]),
  );

  const dtos: GuestDto[] = guests.map((g) => ({
    ...toRecipientDto(g),
    creditBalance: creditByGuest.get(g.id) ?? 0,
    visits: bookingByGuest.get(g.id)?.visits ?? 0,
    ...(bookingByGuest.get(g.id)?.lastStay
      ? { lastStay: bookingByGuest.get(g.id)!.lastStay!.toISOString().slice(0, 10) }
      : {}),
  }));
  return Response.json(dtos);
});

/**
 * POST /api/guesthouse/guests — find-or-create by name (case-insensitive),
 * so typing a repeat guest's name never creates a duplicate record and a
 * first-time guest is saved automatically for next time's dropdown.
 */
export const POST = api(async (request) => {
  await requireCan("guesthouse.manage");
  const data = await validate(request, guestCreateSchema);

  const existing = await prisma.recipient.findFirst({
    where: { type: "GUESTHOUSE", name: { equals: data.name, mode: "insensitive" } },
    include: { district: true },
  });
  if (existing) {
    if (data.email && !existing.email) {
      const updated = await prisma.recipient.update({
        where: { id: existing.id },
        data: { email: data.email },
        include: { district: true },
      });
      return Response.json(toRecipientDto(updated));
    }
    return Response.json(toRecipientDto(existing));
  }

  const created = await prisma.recipient.create({
    data: { name: data.name, type: "GUESTHOUSE", email: data.email },
    include: { district: true },
  });
  return Response.json(toRecipientDto(created), { status: 201 });
});
