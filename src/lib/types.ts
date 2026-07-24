// DTO types shared by API responses and client pages.

export type Category = "BOOK" | "MATERIAL" | "SUPPLY" | "ASSET";

export type Role = "ADMIN" | "STAFF" | "GUESTHOUSE";

export type UnitStatus = "IN_STOCK" | "ISSUED" | "WRITTEN_OFF";

export interface BatchInfo {
  id: string;
  code: string;
  qtyReceived: number;
  qtyOnHand: number;
  receivedAt: string; // ISO datetime
  expiry?: string; // ISO date
  note?: string;
}

export interface UnitInfo {
  id: string;
  serial: string;
  status: UnitStatus;
}

export type WriteOffReason = "DAMAGED" | "WET" | "SPOILED" | "EXPIRED" | "LOST" | "OTHER";

export const WRITE_OFF_REASONS: WriteOffReason[] = [
  "DAMAGED",
  "WET",
  "SPOILED",
  "EXPIRED",
  "LOST",
  "OTHER",
];

export const WRITE_OFF_LABELS: Record<WriteOffReason, string> = {
  DAMAGED: "Damaged",
  WET: "Water damage",
  SPOILED: "Spoiled",
  EXPIRED: "Expired",
  LOST: "Lost / missing",
  OTHER: "Other",
};

/** One row per item per stockroom (an ItemStock joined to its Item). */
export interface Item {
  id: string; // ItemStock id — what dispense/bulk actions reference
  itemId: string;
  name: string;
  model?: string; // product model / edition
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
  serialized: boolean;
  description?: string;
  frequent?: boolean;
  batches: BatchInfo[];
  units?: UnitInfo[]; // serialized items only
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
  | "WRITE_OFF"
  | "RETURN";

export interface MovementLineInfo {
  batchCode: string;
  qty: number;
  serial?: string;
  unitId?: string;
}

export interface Movement {
  id: string;
  type: MovementType;
  direction: "IN" | "OUT";
  itemName: string;
  serialized: boolean;
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
  writeOffReason?: WriteOffReason;
  note?: string;
  cancelledAt?: string; // ISO datetime — set when this dispense/sale was voided
  lines: MovementLineInfo[];
  /** DISPENSE/SALE only: how much of this issue can still be returned. */
  returnableQty?: number;
  staff: string;
  at: string; // ISO datetime
}

/** Count sheet row: a stock row plus its movement totals for a date range. */
export interface CountSheetRow extends Item {
  beginning: number; // on hand at the start of the range
  inQty: number; // received/transferred in/adjusted up within the range
  outQty: number; // dispensed/sold/etc. within the range (positive number)
  returnedQty: number; // qty returned from dispenses/sales within the range
  writeOffQty: number; // qty written off (damaged/lost) within the range
  ending: number; // on hand at the end of the range
}

export interface CountSheetTotals {
  rowCount: number;
  beginning: number;
  inQty: number;
  outQty: number;
  returnedQty: number;
  writeOffQty: number;
  ending: number;
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
  RETURN: "Returned",
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

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
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
