import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { categoryCreateSchema, categoryUpdateSchema } from "@/lib/validators";

const SELECT = { id: true, name: true, type: true, active: true } as const;

export const GET = api(async (request) => {
  await requireCan("inventory.view");
  const showAll = new URL(request.url).searchParams.get("all") === "1";
  const categories = await prisma.category.findMany({
    where: showAll ? {} : { active: true },
    orderBy: { name: "asc" },
    select: SELECT,
  });
  return Response.json(categories);
});

// Structural/admin-only — day-to-day stock work only needs the list above.
export const POST = api(async (request) => {
  await requireCan("settings.manage");
  const data = await validate(request, categoryCreateSchema);

  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError(409, "A category with this name already exists");

  const category = await prisma.category.create({
    data: { name: data.name, type: data.type },
    select: SELECT,
  });
  return Response.json(category, { status: 201 });
});

export const PATCH = api(async (request) => {
  await requireCan("settings.manage");
  const data = await validate(request, categoryUpdateSchema);

  const target = await prisma.category.findUnique({ where: { id: data.id } });
  if (!target) throw new ApiError(404, "Category not found");

  if (data.action === "rename") {
    const existing = await prisma.category.findUnique({ where: { name: data.name! } });
    if (existing && existing.id !== data.id) {
      throw new ApiError(409, "A category with this name already exists");
    }
  }

  const updated = await prisma.category.update({
    where: { id: data.id },
    data:
      data.action === "rename"
        ? { name: data.name }
        : data.action === "retype"
          ? { type: data.type }
          : { active: data.action === "activate" },
    select: SELECT,
  });
  return Response.json(updated);
});

// Hard delete — only allowed once no item uses this category.
export const DELETE = api(async (request) => {
  await requireCan("settings.manage");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new ApiError(422, "id is required");

  const target = await prisma.category.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, "Category not found");

  const itemCount = await prisma.item.count({ where: { categoryId: id } });
  if (itemCount > 0) {
    throw new ApiError(409, `Can't delete — ${itemCount} item(s) use this category. Deactivate it instead.`);
  }

  await prisma.category.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
