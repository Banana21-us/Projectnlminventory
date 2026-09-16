import type { Role } from "@prisma/client";

// Laravel-style gates: one place that says which role can do what.
// Check with `can(role, "users.manage")` in UI and API alike.
export const PERMISSIONS = {
  "inventory.view": ["ADMIN", "STAFF"],
  "inventory.manage": ["ADMIN", "STAFF"],
  "inventory.pricing": ["ADMIN"],
  "dispense.create": ["ADMIN", "STAFF"],
  "movements.view": ["ADMIN", "STAFF"],
  "movements.cancel": ["ADMIN", "STAFF"],
  "reports.view": ["ADMIN", "STAFF"],
  "recipients.view": ["ADMIN", "STAFF"],
  "recipients.manage": ["ADMIN", "STAFF"],
  "users.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "guesthouse.view": ["ADMIN", "GUESTHOUSE"],
  "guesthouse.manage": ["ADMIN", "GUESTHOUSE"],
  // Front desk runs the rooms; money decisions stay with ADMIN. The split
  // mirrors inventory.view/manage vs inventory.pricing.
  "guesthouse.accounting": ["ADMIN"], // revenue/cost aggregates, period PDF
  "guesthouse.adjust": ["ADMIN"], // discounts, extra charges, comps, refunds,
  //                                 post-checkout night corrections
  "guesthouse.rooms": ["ADMIN"], // room setup, rates, maintenance blocks, period lock
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Where each role lands after login / when denied a page. */
export function homeFor(role: Role): string {
  return role === "GUESTHOUSE" ? "/guesthouse" : "/dashboard";
}
