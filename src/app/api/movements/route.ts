import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { toMovementDto } from "@/lib/dto";
import { dispenseNoticeMail } from "@/lib/mail-templates";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { applyStockAction } from "@/lib/stock";
import { movementCreateSchema } from "@/lib/validators";

export const GET = api(async () => {
  await requireCan("movements.view");
  const movements = await prisma.movement.findMany({
    include: {
      item: { include: { stocks: true, category: true } },
      stockroom: true,
      user: true,
      recipient: { include: { district: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return Response.json(
    movements.map((m) =>
      toMovementDto(
        m,
        m.item.stocks.find((s) => s.stockroomId === m.stockroomId)?.shelf ?? "—",
      ),
    ),
  );
});

export const POST = api(async (request) => {
  const user = await requireCan("dispense.create");
  const data = await validate(request, movementCreateSchema);

  if (data.recipientId) {
    const recipient = await prisma.recipient.findFirst({
      where: { id: data.recipientId, active: true },
    });
    if (!recipient) throw new ApiError(422, "Unknown recipient");
  }

  const movement = await applyStockAction({
    stockId: data.stockId,
    userId: user.id,
    qty: data.qty,
    type: data.type,
    purpose: data.type === "SALE" ? undefined : data.purpose,
    recipientId: data.recipientId,
    issuedToName: data.issuedTo,
    unitCost: data.unitCost,
    unitPrice: data.unitPrice,
    orNumber: data.orNumber,
    reference: data.reference,
    note: data.note,
  });

  const shelf = await prisma.itemStock.findUnique({ where: { id: data.stockId } });

  // Best-effort notification — never let email trouble fail the dispense
  // itself. sendMail() no-ops quietly if SMTP isn't configured yet.
  if ((data.type === "DISPENSE" || data.type === "SALE") && movement.recipient?.email) {
    const { subject, text } = dispenseNoticeMail({
      recipientName: movement.recipient.name,
      itemName: movement.item.name,
      qty: Math.abs(movement.qty),
      unit: movement.item.unit,
      staffName: user.name,
      at: movement.createdAt,
      ...(movement.orNumber ? { orNumber: movement.orNumber } : {}),
      ...(movement.unitPrice !== null ? { unitPrice: Number(movement.unitPrice) } : {}),
    });
    void sendMail({ to: movement.recipient.email, subject, text });
  }

  return Response.json(toMovementDto(movement, shelf?.shelf ?? "—"), { status: 201 });
});
