import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { toRecipientDto } from "@/lib/dto";
import { prisma } from "@/lib/prisma";
import { recipientCreateSchema, recipientUpdateSchema } from "@/lib/validators";

const RECIPIENT_TYPES = ["PASTOR", "CHURCH", "MEMBER", "DEPARTMENT", "GUESTHOUSE", "OTHER"];

export const GET = api(async (request) => {
  await requireCan("recipients.view");
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search")?.trim();
  const showAll = url.searchParams.get("all") === "1";

  if (type && !RECIPIENT_TYPES.includes(type)) {
    throw new ApiError(422, "Unknown recipient type");
  }
  // The management view (showAll) needs to see inactive rows too — gated
  // separately since it's an admin-only screen, unlike the dispense picker.
  if (showAll) await requireCan("settings.manage");

  const recipients = await prisma.recipient.findMany({
    where: {
      ...(showAll ? {} : { active: true }),
      ...(type ? { type: type as never } : {}),
      ...(search ? { name: { contains: search } } : {}),
    },
    include: { district: true },
    orderBy: { name: "asc" },
    take: showAll ? undefined : 50,
  });
  return Response.json(recipients.map(toRecipientDto));
});

// Quick-add so staff can register a pastor/department/guest on the fly
// instead of being blocked when a name isn't in the list yet.
export const POST = api(async (request) => {
  await requireCan("recipients.manage");
  const data = await validate(request, recipientCreateSchema);

  if (data.districtId) {
    const district = await prisma.district.findFirst({
      where: { id: data.districtId, active: true },
    });
    if (!district) throw new ApiError(422, "Unknown district");
  }

  const recipient = await prisma.recipient.create({
    data: {
      name: data.name,
      type: data.type,
      districtId: data.districtId,
      email: data.email,
    },
    include: { district: true },
  });
  return Response.json(toRecipientDto(recipient), { status: 201 });
});

// Rename/reassign-district/activate/deactivate — admin-only, unlike the
// quick-add above which staff also use mid-dispense.
export const PATCH = api(async (request) => {
  await requireCan("settings.manage");
  const data = await validate(request, recipientUpdateSchema);

  const target = await prisma.recipient.findUnique({ where: { id: data.id } });
  if (!target) throw new ApiError(404, "Recipient not found");

  if (data.action === "rename") {
    const existing = await prisma.recipient.findFirst({
      where: { name: data.name, type: target.type, NOT: { id: data.id } },
    });
    if (existing) throw new ApiError(409, "Another entry with this name already exists");
  }

  if (data.action === "setDistrict" && data.districtId) {
    const district = await prisma.district.findFirst({
      where: { id: data.districtId, active: true },
    });
    if (!district) throw new ApiError(422, "Unknown district");
  }

  const updated = await prisma.recipient.update({
    where: { id: data.id },
    data:
      data.action === "rename"
        ? { name: data.name }
        : data.action === "setDistrict"
          ? { districtId: data.districtId ?? null }
          : data.action === "setEmail"
            ? { email: data.email ?? null }
            : { active: data.action === "activate" },
    include: { district: true },
  });
  return Response.json(toRecipientDto(updated));
});

// Hard delete — only allowed once no movement (dispense/sale history) references this recipient.
export const DELETE = api(async (request) => {
  await requireCan("settings.manage");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new ApiError(422, "id is required");

  const target = await prisma.recipient.findUnique({ where: { id } });
  if (!target) throw new ApiError(404, "Recipient not found");

  const movementCount = await prisma.movement.count({ where: { recipientId: id } });
  if (movementCount > 0) {
    throw new ApiError(
      409,
      `Can't delete — ${movementCount} movement(s) reference this recipient. Deactivate it instead.`,
    );
  }

  await prisma.recipient.delete({ where: { id } });
  return new Response(null, { status: 204 });
});
