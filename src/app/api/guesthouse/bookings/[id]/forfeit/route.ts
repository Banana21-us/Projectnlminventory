import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { forfeitPayment } from "@/lib/booking";
import { BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import { forfeitCreateSchema } from "@/lib/validators";

/**
 * POST /api/guesthouse/bookings/[id]/forfeit
 *
 * Keeps a no-show's reservation fee as revenue instead of refunding or
 * crediting it. Same ADMIN-only tier as refund/credit — a money decision.
 */
export const POST = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireCan("guesthouse.adjust");
  const { id } = await params;
  const data = await validate(request, forfeitCreateSchema);

  await forfeitPayment(id, user.id, data.reason);

  const row = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  if (!row) throw new ApiError(404, "Booking not found");
  return Response.json(toBookingDto(row, { detail: true }), { status: 201 });
});
