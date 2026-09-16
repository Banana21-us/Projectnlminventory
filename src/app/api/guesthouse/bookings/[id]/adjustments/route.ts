import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { recordAdjustment } from "@/lib/booking";
import { BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import { adjustmentCreateSchema } from "@/lib/validators";

/**
 * POST /api/guesthouse/bookings/[id]/adjustments
 *
 * Discounts and extra charges are both ADMIN decisions. The service layer
 * enforces the rule that a discount can only land before any payment — after
 * settlement it would be a refund, which is a separate, deliberate act.
 */
export const POST = api(async (request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireCan("guesthouse.adjust");
  const { id } = await params;
  const data = await validate(request, adjustmentCreateSchema);

  await recordAdjustment(id, user.id, {
    kind: data.kind,
    amount: data.amount,
    reason: data.reason,
  });

  const row = await prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
  if (!row) throw new ApiError(404, "Booking not found");
  return Response.json(toBookingDto(row, { detail: true }), { status: 201 });
});
