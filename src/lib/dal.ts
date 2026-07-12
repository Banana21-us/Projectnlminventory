import { ZodError, type ZodType } from "zod";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { can, type Permission } from "./policies";
import { ApiError } from "./errors";
import type { Role } from "@prisma/client";

export { ApiError } from "./errors";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Data Access Layer guard — the Laravel `auth` middleware equivalent,
 * but enforced next to the data as Next.js recommends. Every route
 * handler must call this; the proxy is only an optimistic first check.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const sessionUser = session?.user as (SessionUser & { id?: string }) | undefined;
  if (!sessionUser?.id || !sessionUser.role) throw new ApiError(401, "Unauthenticated");

  // JWT sessions outlive account changes, so re-check the database:
  // a deactivated user or changed role takes effect immediately.
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) throw new ApiError(401, "Account is disabled");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Gate check — Laravel `Gate::authorize()`. */
export async function requireCan(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new ApiError(403, "Not permitted");
  return user;
}

/** FormRequest-style body validation: returns typed data or throws 422. */
export async function validate<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first.path.length ? `${first.path.join(".")}: ` : "";
    throw new ApiError(422, `${where}${first.message}`);
  }
  return result.data;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/**
 * Route wrapper — Laravel's exception handler. Converts ApiError and
 * ZodError into JSON error responses instead of 500s.
 */
export function api<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (e) {
      if (e instanceof ApiError) {
        return Response.json({ error: e.message }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return Response.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 422 });
      }
      console.error("[api]", e);
      return Response.json({ error: "Server error" }, { status: 500 });
    }
  };
}
