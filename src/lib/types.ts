// DTO types shared by API responses and client pages.

export type Category = "BOOK" | "MATERIAL" | "SUPPLY" | "ASSET";

export type Role = "ADMIN" | "STAFF" | "GUESTHOUSE";

/** One row per item per stockroom (an ItemStock joined to its Item). */
export interface Item {
  id: string; // ItemStock id — what dispense/bulk actions reference
  itemId: string;
  name: string;
  category: Category;
  categoryName: string;
  shelf: string;
  stockroomId: string;
  location: string; // stockroom name
  stock: number;
  maxStock: number;
  unit: string;
  sellingPrice: number;
  avgCost: number;
  description?: string;
  frequent?: boolean;
}

export interface StockroomDto {
  id: string;
  name: string;
  active: boolean;
}

export interface CategoryDto {
  id: string;
  name: string;
  type: Category;
  active: boolean;
}

export type RecipientType = "PASTOR" | "CHURCH" | "MEMBER" | "DEPARTMENT" | "GUESTHOUSE" | "OTHER";

export interface RecipientDto {
  id: string;
  name: string;
  type: RecipientType;
  email?: string;
  districtId?: string;
  districtName?: string;
  active: boolean;
}

export interface DistrictDto {
  id: string;
  name: string;
  active: boolean;
}

/** The three quick-pick tabs in the dispense recipient picker. */
export type RecipientTab = "DEPARTMENT" | "PASTOR" | "GUEST";

export const RECIPIENT_TAB_TYPE: Record<RecipientTab, RecipientType> = {
  DEPARTMENT: "DEPARTMENT",
  PASTOR: "PASTOR",
  GUEST: "GUESTHOUSE",
};

export const RECIPIENT_TAB_LABELS: Record<RecipientTab, string> = {
  DEPARTMENT: "Department",
  PASTOR: "Pastor",
  GUEST: "Guest",
};

/** Selecting a recipient in a given tab implies this dispense purpose. */
export const RECIPIENT_TAB_PURPOSE: Record<RecipientTab, string> = {
  DEPARTMENT: "OFFICE_USE",
  PASTOR: "PASTOR_ISSUE",
  GUEST: "GUESTHOUSE",
};

export type MovementType =
  | "RECEIVE"
  | "DISPENSE"
  | "SALE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT"
  | "WRITE_OFF";

export interface Movement {
  id: string;
  type: MovementType;
  direction: "IN" | "OUT";
  itemName: string;
  unit: string;
  category?: string;
  shelf: string;
  location: string;
  qty: number;
  unitCost: number;
  purpose?: string;
  issuedTo?: string;
  orNumber?: string;
  unitPrice?: number;
  reference?: string;
  note?: string;
  staff: string;
  at: string; // ISO datetime
}

export interface DashboardData {
  totals: {
    itemsTracked: number;
    stockUnits: number;
    inventoryValue: number;
    lowStockCount: number;
    dispensedQtyAllTime: number;
    dispensedCostAllTime: number;
    salesRevenueAllTime: number;
  };
  series: { label: string; qty: number; cost: number; revenue: number }[];
  byCategory: { name: string; count: number; units: number }[];
  byMovementType: { type: MovementType; count: number }[];
  topItems: { name: string; qty: number }[];
}

export const CATEGORIES: Category[] = ["BOOK", "MATERIAL", "SUPPLY", "ASSET"];

export const CATEGORY_LABELS: Record<Category, string> = {
  BOOK: "Bible books",
  MATERIAL: "Materials",
  SUPPLY: "Supplies",
  ASSET: "Assets",
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  RECEIVE: "Received",
  DISPENSE: "Dispensed",
  SALE: "Sold",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  ADJUSTMENT: "Adjustment",
  WRITE_OFF: "Write-off",
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

export function formatRelative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
