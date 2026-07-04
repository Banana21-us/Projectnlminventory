import bcrypt from "bcryptjs";
import { api, requireCan, validate, ApiError } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { userCreateSchema, userUpdateSchema } from "@/lib/validators";

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

export const GET = api(async () => {
  await requireCan("users.manage");
  const users = await prisma.user.findMany({
    select: PUBLIC_FIELDS,
    orderBy: { createdAt: "asc" },
  });
  return Response.json(users);
});

// Account creation is admin-only — there is no self-registration.
export const POST = api(async (request) => {
  const admin = await requireCan("users.manage");
  const data = await validate(request, userCreateSchema);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: await bcrypt.hash(data.password, 12),
      role: data.role,
      createdById: admin.id,
    },
    select: PUBLIC_FIELDS,
  });
  return Response.json(user, { status: 201 });
});

export const PATCH = api(async (request) => {
  const admin = await requireCan("users.manage");
  const data = await validate(request, userUpdateSchema);

  const target = await prisma.user.findUnique({ where: { id: data.id } });
  if (!target) throw new ApiError(404, "User not found");

  // Guard rails: an admin cannot lock themselves out, and the last
  // active admin can never be deactivated or demoted.
  if (data.id === admin.id && (data.action === "deactivate" || data.action === "setRole")) {
    throw new ApiError(422, "You cannot change your own role or deactivate yourself");
  }
  if (
    target.role === "ADMIN" &&
    (data.action === "deactivate" || (data.action === "setRole" && data.role !== "ADMIN"))
  ) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) throw new ApiError(422, "There must be at least one active admin");
  }

  const updated = await prisma.user.update({
    where: { id: data.id },
    data:
      data.action === "activate"
        ? { active: true }
        : data.action === "deactivate"
          ? { active: false }
          : data.action === "setRole"
            ? { role: data.role }
            : {
                password: await bcrypt.hash(data.password!, 12),
                mustChangePassword: true,
              },
    select: PUBLIC_FIELDS,
  });
  return Response.json(updated);
});
