import { api, requireCan, validate } from "@/lib/dal";
import { toMovementDto } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { cancelStockMovement } from "@/lib/stock";
import { movementCancelSchema } from "@/lib/validators";

export const POST = api(async (request) => {
  const user = await requireCan("movements.cancel");
  const data = await validate(request, movementCancelSchema);

  const movement = await cancelStockMovement(data.id, user.id, data.reason);

  const stock = await prisma.itemStock.findUnique({
    where: {
      itemId_stockroomId: { itemId: movement.itemId, stockroomId: movement.stockroomId },
    },
  });
  return Response.json(toMovementDto(movement, stock?.shelf ?? "—"));
});
