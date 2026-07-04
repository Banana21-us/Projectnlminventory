import type { Role } from "@prisma/client";

/**
 * Route → allowed-roles map, the Laravel `Route::middleware('role:...')`
 * group table. First matching prefix wins. Pages not listed only require
 * a session.
 */
const GUARDS: { pattern: RegExp; roles: Role[] }[] = [
  { pattern: /^\/admin(\/|$)/, roles: ["ADMIN"] },
  { pattern: /^\/api\/admin(\/|$)/, roles: ["ADMIN"] },
  { pattern: /^\/guesthouse(\/|$)/, roles: ["ADMIN", "GUESTHOUSE"] },
  { pattern: /^\/api\/guesthouse(\/|$)/, roles: ["ADMIN", "GUESTHOUSE"] },
  {
    pattern: /^\/(dashboard|inventory|dispense|log|receiving|reports)(\/|$)/,
    roles: ["ADMIN", "STAFF"],
  },
  {
    pattern: /^\/api\/(items|movements|stockrooms|categories|reports|districts|recipients)(\/|$)/,
    roles: ["ADMIN", "STAFF"],
  },
  // "/" itself has no role restriction — the proxy redirects it to the
  // signed-in user's home before this table is even consulted.
];

export function allowedForRole(pathname: string, role: Role): boolean {
  const guard = GUARDS.find((g) => g.pattern.test(pathname));
  return !guard || guard.roles.includes(role);
}
