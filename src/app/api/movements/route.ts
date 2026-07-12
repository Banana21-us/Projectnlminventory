import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { toMovementDto } from "@/lib/dto";
import { dispenseNoticeMail } from "@/lib/mail-templates";
import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { applyStockAction } from "@/lib/stock";
import { movementCreateSchema } from "@/lib/validators";

const MOVEMENT_INCLUDE = {
  item: { include: { stocks: true, category: true } },
  stockroom: true,
  user: true,
  recipient: { include: { district: true } },
  lines: { include: { batch: true, assetUnit: true } },
} as const;

export const GET = api(async () => {
  await requireCan("movements.view");
  const movements = await prisma.movement.findMany({
    include: MOVEMENT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  // How much of each DISPENSE/SALE has already come back via RETURNs, so
  // the client knows whether a "Return" action still makes sense.
  const returnedByRef = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== "RETURN" || !m.reference) continue;
    returnedByRef.set(m.reference, (returnedByRef.get(m.reference) ?? 0) + m.qty);
  }

  return Response.json(
    movements.map((m) => {
      const dto = toMovementDto(
        m,
        m.item.stocks.find((s) => s.stockroomId === m.stockroomId)?.shelf ?? "—",
      );
      if ((m.type === "DISPENSE" || m.type === "SALE") && !m.cancelledAt) {
        dto.returnableQty = Math.max(0, dto.qty - (returnedByRef.get(m.id) ?? 0));
      }
      return dto;
    }),
  );
});

export const POST = api(async (request) => {
  const data = await validate(request, movementCreateSchema);
  const user =
    data.type === "RECEIVE" || data.type === "WRITE_OFF"
      ? await requireCan("inventory.manage")
      : await requireCan("dispense.create");

  if (data.recipientId) {
    const recipient = await prisma.recipient.findFirst({
      where: { id: data.recipientId, active: true },
    });
    if (!recipient) throw new ApiError(422, "Unknown recipient");
  }

  const movement = await applyStockAction({
    stockId: data.stockId,
    userId: user.id,
    qty: data.qty ?? 0,
    type: data.type,
    purpose: data.type === "SALE" || data.type === "WRITE_OFF" ? undefined : data.purpose,
    recipientId: data.recipientId,
    issuedToName: data.issuedTo,
    unitCost: data.unitCost,
    unitPrice: data.unitPrice,
    orNumber: data.orNumber,
    reference: data.reference,
    note: data.note,
    batchId: data.batchId,
    batchCode: data.batchCode,
    expiry: data.expiry,
    serials: data.serials,
    unitIds: data.unitIds,
    writeOffReason: data.writeOffReason,
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
