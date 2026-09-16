import { api, requireCan, validate } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { dateOnly, toDateString } from "@/lib/booking";
import { periodLockSchema } from "@/lib/validators";

/** GET /api/guesthouse/settings — mainly: how far back the books are closed. */
export const GET = api(async () => {
  await requireCan("guesthouse.view");
  const settings = await prisma.guesthouseSettings.findUnique({
    where: { id: "default" },
    include: { lockedBy: true },
  });
  return Response.json({
    lockedThrough: settings?.lockedThrough ? toDateString(settings.lockedThrough) : null,
    lockedBy: settings?.lockedBy?.name ?? null,
  });
});

/**
 * PATCH /api/guesthouse/settings — close or reopen a period.
 *
 * Closing freezes every stay and payment on or before that date so a filed
 * treasurer's report stays reproducible. Reopening is deliberate and logged
 * by the updatedAt/lockedBy pair — the filed PDF has to be reissued after.
 */
export const PATCH = api(async (request) => {
  const user = await requireCan("guesthouse.rooms");
  const data = await validate(request, periodLockSchema);

  const lockedThrough = data.lockedThrough ? dateOnly(data.lockedThrough) : null;
  await prisma.guesthouseSettings.upsert({
    where: { id: "default" },
    create: { id: "default", lockedThrough, lockedById: user.id },
    update: { lockedThrough, lockedById: user.id },
  });
  return Response.json({ lockedThrough: lockedThrough ? toDateString(lockedThrough) : null });
});
