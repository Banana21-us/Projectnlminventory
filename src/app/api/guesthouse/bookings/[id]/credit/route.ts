import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { issueGuestCredit } from "@/lib/booking";
import { BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import { guestCreditCreateSchema } from "@/lib/validators";

/**
 * POST /api/guesthouse/bookings/[id]/credit
 *
 * Turns an overpayment into guest credit instead of a cash refund. Same
 * ADMIN-only tier as recording a payment/refund — a money decision, not a
 * front-desk one.
 */
export const POST = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireCan("guesthouse.adjust");
  const { id } = await params;
  const data = await validate(request, guestCreditCreateSchema);

  await issueGuestCredit(id, user.id, { amount: data.amount, reason: data.reason });

  const row = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  if (!row) throw new ApiError(404, "Booking not found");
  return Response.json(toBookingDto(row, { detail: true }), { status: 201 });
});
