import { api, requireCan } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/guesthouse/payers — departments and districts a stay can be
 * charged to.
 *
 * A narrow, read-only slice of the recipient list: /api/recipients is gated
 * to ADMIN+STAFF, and the front desk needs exactly these names and nothing
 * else to record a charge-to-department settlement.
 */
export const GET = api(async () => {
  await requireCan("guesthouse.view");

  const rows = await prisma.recipient.findMany({
    where: { active: true, type: { in: ["DEPARTMENT", "CHURCH"] } },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
  return Response.json(rows);
});
