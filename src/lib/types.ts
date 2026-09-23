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

/** A GUESTHOUSE recipient with their stay history rolled up — powers the
 *  Guests tab and its detail sheet. */
export interface GuestDto extends RecipientDto {
  creditBalance: number;
  visits: number;
  lastStay?: string;
}

export interface GuestCreditEntry {
  id: string;
  amount: number;
  reason: string | null;
  at: string;
  sourceBookingId?: string;
  usedBookingId?: string;
}

export interface GuestDetail {
  guest: RecipientDto;
  creditBalance: number;
  bookings: Booking[];
  credits: GuestCreditEntry[];
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
  /** SRP snapshot at the time (DISPENSE/SALE only) — unitPrice below this is a discount/free give-away. */
  listPrice?: number;
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

// ── Guesthouse ──────────────────────────────────────────────────

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "GCASH"
  | "CHECK"
  | "CHARGE_TO_DEPARTMENT"
  | "CREDIT"
  | "OTHER";

export type AdjustmentKind = "DISCOUNT" | "CHARGE";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Tentative",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "In-house",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  CHECK: "Check",
  CHARGE_TO_DEPARTMENT: "Charge to department",
  CREDIT: "Guest credit",
  OTHER: "Other",
};

export interface FolioTotals {
  charge: number;
  discounts: number;
  extraCharges: number;
  netTotal: number;
  paid: number;
  balance: number;
}

export interface PaymentDto {
  id: string;
  amount: number;
  method: PaymentMethod;
  payerName?: string;
  settledAt?: string;
  orNumber?: string;
  reference?: string;
  note?: string;
  paidAt: string;
  recordedBy: string;
}

export interface AdjustmentDto {
  id: string;
  kind: AdjustmentKind;
  amount: number;
  reason: string;
  createdBy: string;
  at: string;
}

export interface BookingEventDto {
  id: string;
  type: string;
  detail?: string;
  actor: string;
  at: string;
}

export interface RoomStayDto {
  roomName: string;
  from: string;
  to: string;
  rate: number;
  reason?: string;
}

export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  guestName: string;
  contact?: string;
  recipientId?: string;
  groupId?: string;
  groupName?: string;
  checkIn: string; // date-only, "2026-09-18"
  checkOut: string; // date-only, exclusive
  nights: number; // as booked — never changes
  billedNights: number; // what money is computed from
  nightlyRate: number;
  occupants: number;
  /** Headcount actually observed at arrival, when it differs from `occupants`. */
  actualOccupants?: number;
  status: BookingStatus;
  holdUntil?: string;
  complimentary: boolean;
  compReason?: string;
  /** What a complimentary stay would have billed. */
  notionalValue?: number;
  cancelReason?: string;
  note?: string;
  /** Room names in stay order, present only when the guest moved rooms. */
  stayRooms?: string[];
  totals: FolioTotals;
  createdBy: string;
  createdAt: string;
  /** Detail view only. */
  payments?: PaymentDto[];
  adjustments?: AdjustmentDto[];
  events?: BookingEventDto[];
  stays?: RoomStayDto[];
}

export interface RoomDto {
  id: string;
  name: string;
  rate: number;
  capacity?: number;
  notes?: string;
  outOfService: boolean;
  needsCleaning: boolean;
  /** Derived from stays + blocks, never hand-set. */
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
  /** Set when currently occupied. */
  guestName?: string;
  until?: string;
  bookingId?: string;
  blocks?: { id: string; from: string; to: string; reason: string }[];
}

export interface RoomAvailabilityDto {
  id: string;
  name: string;
  rate: number;
  capacity: number | null;
  needsCleaning: boolean;
  outOfService: boolean;
  busyNights: string[];
  free: boolean;
  conflict: string | null;
}

export interface TodayBoard {
  date: string;
  counts: { arrivals: number; departures: number; inHouse: number; free: number; needsCleaning: number };
  arrivals: Booking[];
  departures: Booking[];
  inHouse: Booking[];
  /** CONFIRMED bookings whose check-in date has passed — one tap to no-show. */
  didNotArrive: Booking[];
  /** PENDING holds past their hold date. */
  expiredHolds: Booking[];
  rooms: RoomDto[];
}

export interface GuesthouseReport {
  range: DashboardRangeKey;
  totals: {
    grossRevenue: number;
    discounts: number;
    extraCharges: number;
    netRevenue: number;
    collected: number;
    supplyCost: number;
    netContribution: number;
    compedNights: number;
    compedValue: number;
    occupancyPct: number;
    avgNightlyRate: number;
    roomNightsSold: number;
    roomNightsAvailable: number;
    cancellations: number;
    noShows: number;
    outstanding: number;
    refundsDue: number;
    receivables: number;
  };
  series: { label: string; revenue: number; cost: number; nights: number }[];
  roomPerformance: { name: string; nights: number; revenue: number; occupancyPct: number }[];
  discountsGiven: {
    id: string;
    bookingId: string;
    guestName: string;
    amount: number;
    reason: string;
    by: string;
    at: string;
  }[];
  outstandingBalances: { id: string; guestName: string; roomName: string; checkOut: string; balance: number }[];
  refundsDue: { id: string; guestName: string; roomName: string; checkOut: string; amount: number }[];
  receivables: {
    paymentId: string;
    bookingId: string;
    guestName: string;
    payerName: string;
    amount: number;
    paidAt: string;
  }[];
  lockedThrough?: string;
}

export type DashboardRangeKey = "day" | "week" | "month" | "year";
