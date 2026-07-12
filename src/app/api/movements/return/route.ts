import { api, requireCan, validate } from "@/lib/dal";
import { toMovementDto } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { returnStockMovement } from "@/lib/stock";
import { movementReturnSchema } from "@/lib/validators";

export const POST = api(async (request) => {
  const user = await requireCan("movements.cancel");
  const data = await validate(request, movementReturnSchema);

  const movement = await returnStockMovement({
    movementId: data.id,
    userId: user.id,
    qty: data.qty,
    unitIds: data.unitIds,
    condition: data.condition,
    note: data.note,
  });

  const stock = await prisma.itemStock.findUnique({
    where: { itemId_stockroomId: { itemId: movement.itemId, stockroomId: movement.stockroomId } },
  });
  return Response.json(toMovementDto(movement, stock?.shelf ?? "—"), { status: 201 });
});
