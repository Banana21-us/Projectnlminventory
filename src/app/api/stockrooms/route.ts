import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { stockroomCreateSchema, stockroomUpdateSchema } from "@/lib/validators";

const SELECT = { id: true, name: true, active: true } as const;

export const GET = api(async (request) => {
  await requireCan("inventory.view");
  const showAll = new URL(request.url).searchParams.get("all") === "1";
  const stockrooms = await prisma.stockroom.findMany({
    where: showAll ? {} : { active: true },
    orderBy: { name: "asc" },
    select: SELECT,
  });
  return Response.json(stockrooms);
});

// Structural/admin-only — day-to-day stock work only needs the list above.
export const POST = api(async (request) => {
  await requireCan("settings.manage");
  const data = await validate(request, stockroomCreateSchema);

  const existing = await prisma.stockroom.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, "A stockroom with this name already exists");

  const stockroom = await prisma.stockroom.create({ data: { name: data.name }, select: SELECT });
  return Response.json(stockroom, { status: 201 });
});

export const PATCH = api(async (request) => {
  await requireCan("settings.manage");
  const data = await validate(request, stockroomUpdateSchema);

  const target = await prisma.stockroom.findUnique({ where: { id: data.id } });
  if (!target) throw new ApiError(404, "Stockroom not found");

  if (data.action === "rename") {
    const existing = await prisma.stockroom.findUnique({ where: { name: data.name! } });
    if (existing && existing.id !== data.id) {
      throw new ApiError(409, "A stockroom with this name already exists");
    }
  }

  const updated = await prisma.stockroom.update({
    where: { id: data.id },
    data:
      data.action === "rename"
        ? { name: data.name }
        : { active: data.action === "activate" },
    select: SELECT,
  });
  return Response.json(updated);
});

// Hard delete — only allowed once nothing references this stockroom.
// Otherwise deactivate() above is the safe path (keeps history intact).
export const DELETE = api(async (request) => {
  await requireCan("settings.manage");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new ApiError(422, "id is required");

  const target = await prisma.stockroom.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, "Stockroom not found");

  const [stockCount, movementCount] = await Promise.all([
    prisma.itemStock.count({ where: { stockroomId: id } }),
    prisma.movement.count({ where: { stockroomId: id } }),
  ]);
  if (stockCount > 0 || movementCount > 0) {
    throw new ApiError(
      409,
      `Can't delete — ${stockCount} item(s) stocked here and ${movementCount} movement(s) reference it. Deactivate it instead.`,
    );
  }

  await prisma.stockroom.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
