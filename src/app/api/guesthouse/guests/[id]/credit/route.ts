import { api, requireCan, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { guestCreditBalance } from "@/lib/booking";

/** GET /api/guesthouse/guests/[id]/credit — available credit for the settle panel. */
export const GET = api(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  await requireCan("guesthouse.view");
  const { id } = await params;

  const guest = await prisma.recipient.findFirst({ where: { id, type: "GUESTHOUSE" } });
  if (!guest) throw new ApiError(404, "Guest not found");

  const available = await guestCreditBalance(id);
  return Response.json({ available });
});
