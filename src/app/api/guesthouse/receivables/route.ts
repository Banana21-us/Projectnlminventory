import { api, requireCan, validate } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { settleReceivables } from "@/lib/booking";
import { receivableSettleSchema } from "@/lib/validators";

/**
 * GET /api/guesthouse/receivables — stays charged to a department or district
 * that the office has not yet paid for. These are settled balances from the
 * guest's side but money the guesthouse is still owed.
 */
export const GET = api(async () => {
  await requireCan("guesthouse.accounting");

  const rows = await prisma.payment.findMany({
    where: { method: "CHARGE_TO_DEPARTMENT", settledAt: null },
    include: { payer: true, booking: { select: { id: true, guestName: true, room: true } } },
    orderBy: { paidAt: "asc" },
  });

  return Response.json(
    rows.map((r) => ({
      paymentId: r.id,
      bookingId: r.booking.id,
      guestName: r.booking.guestName,
      roomName: r.booking.room.name,
      payerName: r.payer?.name ?? "—",
      amount: Number(r.amount),
      paidAt: r.paidAt.toISOString(),
    })),
  );
});

/** POST /api/guesthouse/receivables — mark charges settled, in one batch. */
export const POST = api(async (request) => {
  const user = await requireCan("guesthouse.adjust");
  const data = await validate(request, receivableSettleSchema);

  const settled = await settleReceivables(data.paymentIds, user.id);
  return Response.json({ settled });
});
