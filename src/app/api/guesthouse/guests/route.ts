import { api, requireCan, validate } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { toRecipientDto } from "@/lib/dto";
import { guestCreateSchema } from "@/lib/validators";

/**
 * GET /api/guesthouse/guests?search=
 *
 * Name-suggestion source for the booking sheet's guest field — searches only
 * GUESTHOUSE-type recipients, kept separate from /api/recipients so front
 * desk (guesthouse.view) never needs access to pastor/department data.
 */
export const GET = api(async (request) => {
  await requireCan("guesthouse.view");
  const search = new URL(request.url).searchParams.get("search")?.trim();

  const guests = await prisma.recipient.findMany({
    where: {
      type: "GUESTHOUSE",
      active: true,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { district: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  return Response.json(guests.map(toRecipientDto));
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
