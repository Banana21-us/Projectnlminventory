"use client";

import { useSession } from "next-auth/react";
import { can, type Permission } from "./policies";
import type { Role } from "@prisma/client";

/** Client-side view of the logged-in user + gate checks for UI gating. */
export function useCurrentUser() {
  const { data, status } = useSession();
  const user = data?.user;
  return {
    status,
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: (user?.role ?? null) as Role | null,
    can: (permission: Permission) => can(user?.role, permission),
  };
}
