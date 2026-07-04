import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { districtCreateSchema, districtUpdateSchema } from "@/lib/validators";

const SELECT = { id: true, name: true, active: true } as const;

export const GET = api(async (request) => {
  await requireCan("recipients.view");
  const showAll = new URL(request.url).searchParams.get("all") === "1";
  if (showAll) await requireCan("settings.manage");

  const districts = await prisma.district.findMany({
    where: showAll ? {} : { active: true },
    orderBy: { name: "asc" },
    select: SELECT,
  });
  return Response.json(districts);
});

// Same quick-add pattern as recipients — the NLM district list isn't
// fixed to the 3 seeded samples, staff can register real ones as needed.
export const POST = api(async (request) => {
  await requireCan("recipients.manage");
  const data = await validate(request, districtCreateSchema);

  const existing = await prisma.district.findUnique({ where: { name: data.name } });
  if (existing) {
    if (!existing.active) {
      const reactivated = await prisma.district.update({
        where: { id: existing.id },
        data: { active: true },
        select: SELECT,
      });
      return Response.json(reactivated, { status: 200 });
    }
    throw new ApiError(409, "A district with this name already exists");
  }

  const district = await prisma.district.create({
    data: { name: data.name },
    select: SELECT,
  });
  return Response.json(district, { status: 201 });
});

// Rename/activate/deactivate — admin-only, unlike the quick-add above.
export const PATCH = api(async (request) => {
  await requireCan("settings.manage");
  const data = await validate(request, districtUpdateSchema);

  const target = await prisma.district.findUnique({ where: { id: data.id } });
  if (!target) throw new ApiError(404, "District not found");

  if (data.action === "rename") {
    const existing = await prisma.district.findUnique({ where: { name: data.name! } });
    if (existing && existing.id !== data.id) {
      throw new ApiError(409, "A district with this name already exists");
    }
  }

  const updated = await prisma.district.update({
    where: { id: data.id },
    data:
      data.action === "rename"
        ? { name: data.name }
        : { active: data.action === "activate" },
    select: SELECT,
  });
  return Response.json(updated);
});

// Hard delete — only allowed once no recipient (e.g. a pastor) is assigned here.
export const DELETE = api(async (request) => {
  await requireCan("settings.manage");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new ApiError(422, "id is required");

  const target = await prisma.district.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, "District not found");

  const recipientCount = await prisma.recipient.count({ where: { districtId: id } });
  if (recipientCount > 0) {
    throw new ApiError(
      409,
      `Can't delete — ${recipientCount} recipient(s) are assigned to this district. Deactivate it instead.`,
    );
  }

  await prisma.district.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
