import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { recordPayment } from "@/lib/booking";
import { BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import { paymentCreateSchema } from "@/lib/validators";

/**
 * POST /api/guesthouse/bookings/[id]/payments
 *
 * Front desk settles a stay; handing money back is a different decision, so
 * a negative amount (a refund) needs guesthouse.adjust.
 */
export const POST = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireCan("guesthouse.manage");
  const { id } = await params;
  const data = await validate(request, paymentCreateSchema);

  if (data.amount < 0) await requireCan("guesthouse.adjust");

  await recordPayment(id, user.id, {
    amount: data.amount,
    method: data.method,
    payerId: data.payerId ?? null,
    orNumber: data.orNumber ?? null,
    reference: data.reference ?? null,
    note: data.note ?? null,
    paidAt: data.paidAt ?? null,
  });

  const row = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  if (!row) throw new ApiError(404, "Booking not found");
  return Response.json(toBookingDto(row, { detail: true }), { status: 201 });
});
