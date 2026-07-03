export type Category = "CONSUMABLE" | "ASSET" | "PERISHABLE";

export type Role = "ADMIN" | "STAFF" | "GUESTHOUSE";

export const LOCATIONS = [
  "Central Storeroom",
  "Clinic Store",
  "School Store",
  "Outstation Depot",
] as const;

export type Location = (typeof LOCATIONS)[number];

export interface Item {
  id: string;
  name: string;
  category: Category;
  shelf: string; // e.g. "B2-04"
  location: Location;
  stock: number;
  maxStock: number;
  unit: string;
  expiry?: string; // ISO date, perishables
  frequent?: boolean; // quick-access in dispensing
}

export type MovementType = "IN" | "OUT";

export interface Movement {
  id: string;
  type: MovementType;
  itemId: string;
  itemName: string;
  shelf: string;
  qty: number;
  unit: string;
  issuedTo?: string;
  staff: string;
  at: string; // ISO datetime
}

export const CATEGORIES: Category[] = ["CONSUMABLE", "ASSET", "PERISHABLE"];

export const CATEGORY_LABELS: Record<Category, string> = {
  CONSUMABLE: "Consumable",
  ASSET: "Asset",
  PERISHABLE: "Perishable",
};

export type StockStatus = "ok" | "low" | "critical";

export function stockStatus(item: Pick<Item, "stock" | "maxStock">): StockStatus {
  if (item.stock <= 0) return "critical";
  const ratio = item.stock / Math.max(1, item.maxStock);
  if (ratio <= 0.18) return "critical";
  if (ratio <= 0.4) return "low";
  return "ok";
}

export const STATUS_LABELS: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Low stock",
  critical: "Critical",
};

const NEAR_EXPIRY_DAYS = 45;

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function expiryFlag(item: Item): "expired" | "near" | null {
  if (!item.expiry) return null;
  const d = daysUntil(item.expiry);
  if (d < 0) return "expired";
  if (d <= NEAR_EXPIRY_DAYS) return "near";
  return null;
}

export function formatRelative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
