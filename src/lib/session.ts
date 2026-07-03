import type { Role } from "./types";

// Placeholder session until real authentication is wired in.
// Change `role` to STAFF or GUESTHOUSE to preview the restricted UI.
export const CURRENT_USER: { name: string; role: Role; station: string } = {
  name: "Naomi K.",
  role: "ADMIN",
  station: "Central Storeroom",
};

export function canManageInventory(role: Role): boolean {
  return role === "ADMIN" || role === "STAFF";
}
