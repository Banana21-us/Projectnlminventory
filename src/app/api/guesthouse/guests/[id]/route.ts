import { api, requireCan, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { toRecipientDto, BOOKING_INCLUDE, toBookingDto } from "@/lib/dto";
import { guestCreditBalance } from "@/lib/booking";

/**
 * GET /api/guesthouse/guests/[id] — the Guests tab's detail sheet: the
 * guest's own record, every stay they've booked, their current credit
 * balance, and the ledger rows that got them there (earned + spent).
 */
export const GET = api(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  await requireCan("guesthouse.view");
  const { id } = await params;

  const guest = await prisma.recipient.findFirst({
    where: { id, type: "GUESTHOUSE" },
    include: { district: true },
  });
  if (!guest) throw new ApiError(404, "Guest not found");

  const [bookingRows, creditRows, available] = await Promise.all([
    prisma.booking.findMany({
      where: { recipientId: id },
      include: BOOKING_INCLUDE,
      orderBy: { checkIn: "desc" },
    }),
    prisma.guestCredit.findMany({
      where: { recipientId: id },
      orderBy: { createdAt: "desc" },
    }),
    guestCreditBalance(id),
  ]);

  return Response.json({
    guest: toRecipientDto(guest),
    creditBalance: available,
    bookings: bookingRows.map((b) => toBookingDto(b)),
    credits: creditRows.map((c) => ({
      id: c.id,
      amount: Number(c.amount),
      reason: c.reason,
      at: c.createdAt.toISOString(),
      ...(c.sourceBookingId ? { sourceBookingId: c.sourceBookingId } : {}),
      ...(c.usedBookingId ? { usedBookingId: c.usedBookingId } : {}),
    })),
  });
});
