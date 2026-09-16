import { z } from "zod";

// FormRequest-style schemas: one per endpoint, validated in the DAL.

const writeOffReasonSchema = z.enum(["DAMAGED", "WET", "SPOILED", "EXPIRED", "LOST", "OTHER"]);

export const itemCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Item name is required").max(120),
    model: z.string().trim().max(120).optional(),
    categoryId: z.string().min(1, "Category is required"),
    stockroomId: z.string().min(1, "Stockroom is required"),
    shelf: z.string().trim().max(20).optional(),
    unit: z.string().trim().max(30).optional(),
    stock: z.number().int().min(0).default(0),
    maxStock: z.number().int().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    unitCost: z.number().min(0).optional(),
    minStock: z.number().int().min(0).optional(),
    description: z.string().trim().max(500).optional(),
    frequent: z.boolean().optional(),
    serialized: z.boolean().optional(),
    serials: z.array(z.string().trim().min(1)).optional(),
    batchCode: z.string().trim().max(40).optional(),
    expiry: z.string().optional(),
  })
  .refine((v) => !v.serialized || (v.serials?.length ?? 0) > 0, {
    message: "Enter at least one serial number",
    path: ["serials"],
  });

export const itemBulkSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Select at least one item"),
    action: z.enum(["adjust", "transfer", "writeOff"]),
    delta: z.number().int().optional(),
    stockroomId: z.string().optional(),
    writeOffReason: writeOffReasonSchema.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.action !== "adjust" || (v.delta !== undefined && v.delta !== 0), {
    message: "Adjustment amount is required",
    path: ["delta"],
  })
  .refine((v) => v.action !== "transfer" || !!v.stockroomId, {
    message: "Target stockroom is required",
    path: ["stockroomId"],
  })
  .refine((v) => v.action !== "writeOff" || !!v.writeOffReason, {
    message: "A reason is required to write off stock",
    path: ["writeOffReason"],
  });

export const movementCreateSchema = z
  .object({
    stockId: z.string().min(1, "Item is required"),
    type: z.enum(["RECEIVE", "DISPENSE", "SALE", "WRITE_OFF"]),
    qty: z.number().int().min(1).optional(),
    purpose: z.string().trim().max(120).optional(),
    issuedTo: z.string().trim().max(120).optional(),
    recipientId: z.string().optional(),
    unitCost: z.number().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
    orNumber: z.string().trim().max(40).optional(),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
    batchId: z.string().optional(),
    batchCode: z.string().trim().max(40).optional(),
    expiry: z.string().optional(),
    serials: z.array(z.string().trim().min(1)).optional(),
    unitIds: z.array(z.string().min(1)).optional(),
    writeOffReason: writeOffReasonSchema.optional(),
  })
  .refine((v) => v.type !== "SALE" || v.unitPrice !== undefined, {
    message: "Unit price is required for sales",
    path: ["unitPrice"],
  })
  .refine((v) => v.type !== "WRITE_OFF" || !!v.writeOffReason, {
    message: "A reason is required to write off stock",
    path: ["writeOffReason"],
  })
  .refine(
    (v) =>
      (v.qty !== undefined && v.qty >= 1) ||
      (v.serials?.length ?? 0) > 0 ||
      (v.unitIds?.length ?? 0) > 0,
    { message: "Quantity is required", path: ["qty"] },
  );

export const movementCancelSchema = z.object({
  id: z.string().min(1, "Movement is required"),
  reason: z.string().trim().min(1, "Reason is required").max(300),
});

export const movementReturnSchema = z
  .object({
    id: z.string().min(1, "Movement is required"),
    qty: z.number().int().min(1).optional(),
    unitIds: z.array(z.string().min(1)).optional(),
    condition: z.union([z.literal("GOOD"), writeOffReasonSchema]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => (v.qty !== undefined && v.qty >= 1) || (v.unitIds?.length ?? 0) > 0, {
    message: "Quantity is required",
    path: ["qty"],
  });

export const districtCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

export const districtUpdateSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["rename", "activate", "deactivate"]),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((v) => v.action !== "rename" || !!v.name, {
    message: "New name is required",
    path: ["name"],
  });

export const stockroomCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

export const stockroomUpdateSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["rename", "activate", "deactivate"]),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((v) => v.action !== "rename" || !!v.name, {
    message: "New name is required",
    path: ["name"],
  });

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(["BOOK", "MATERIAL", "SUPPLY", "ASSET"]),
});

export const categoryUpdateSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["rename", "retype", "activate", "deactivate"]),
    name: z.string().trim().min(1).max(80).optional(),
    type: z.enum(["BOOK", "MATERIAL", "SUPPLY", "ASSET"]).optional(),
  })
  .refine((v) => v.action !== "rename" || !!v.name, {
    message: "New name is required",
    path: ["name"],
  })
  .refine((v) => v.action !== "retype" || !!v.type, {
    message: "Type is required",
    path: ["type"],
  });

export const recipientUpdateSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["rename", "setDistrict", "setEmail", "activate", "deactivate"]),
    name: z.string().trim().min(1).max(120).optional(),
    districtId: z.string().nullable().optional(),
    email: z.string().trim().toLowerCase().email("Invalid email").nullable().optional(),
  })
  .refine((v) => v.action !== "rename" || !!v.name, {
    message: "New name is required",
    path: ["name"],
  })
  .refine((v) => v.action !== "setEmail" || v.email === null || !!v.email, {
    message: "Invalid email",
    path: ["email"],
  });

export const recipientCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    type: z.enum(["PASTOR", "CHURCH", "MEMBER", "DEPARTMENT", "GUESTHOUSE", "OTHER"]),
    districtId: z.string().optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => v.type !== "PASTOR" || !!v.districtId, {
    message: "District is required for pastors",
    path: ["districtId"],
  });

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role: z.enum(["ADMIN", "STAFF", "GUESTHOUSE"]),
});

export const userUpdateSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["activate", "deactivate", "setRole", "resetPassword"]),
    role: z.enum(["ADMIN", "STAFF", "GUESTHOUSE"]).optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(72).optional(),
  })
  .refine((v) => v.action !== "setRole" || !!v.role, {
    message: "Role is required",
    path: ["role"],
  })
  .refine((v) => v.action !== "resetPassword" || !!v.password, {
    message: "New password is required",
    path: ["password"],
  });

// Reprints already-fetched movement data as a signed receipt PDF — the
// client already legitimately holds this movement, so no DB refetch here.
export const movementReceiptPdfSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  itemName: z.string().min(1),
  unit: z.string().min(1),
  category: z.string().optional(),
  shelf: z.string().min(1),
  location: z.string().min(1),
  qty: z.number(),
  unitCost: z.number(),
  purpose: z.string().optional(),
  issuedTo: z.string().optional(),
  orNumber: z.string().optional(),
  unitPrice: z.number().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  staff: z.string().min(1),
  at: z.string().min(1),
  signature: z.string().startsWith("data:image/png").nullish(),
});

export const itemUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().max(120).optional(),
  categoryId: z.string().min(1).optional(),
  shelf: z.string().trim().max(20).optional(),
  unit: z.string().trim().max(30).optional(),
  maxStock: z.number().int().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  description: z.string().trim().max(500).optional(),
  frequent: z.boolean().optional(),
});

export const itemDeleteSchema = z.object({
  id: z.string().min(1),
});

// ── Guesthouse ──────────────────────────────────────────────────

/** Date-only, "2026-09-18" — stays never carry a time-of-day. */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const bookingCreateSchema = z
  .object({
    roomIds: z.array(z.string().min(1)).min(1, "Pick at least one room").max(20),
    guestName: z.string().trim().min(1, "Guest name is required").max(120),
    contact: z.string().trim().max(120).optional(),
    recipientId: z.string().optional(),
    groupName: z.string().trim().max(120).optional(),
    checkIn: dateString,
    checkOut: dateString,
    occupants: z.number().int().min(1).max(20).optional(),
    note: z.string().trim().max(500).optional(),
    tentative: z.boolean().optional(),
    holdUntil: dateString.optional(),
    complimentary: z.boolean().optional(),
    compReason: z.string().trim().max(200).optional(),
    allowPastDates: z.boolean().optional(),
    checkInNow: z.boolean().optional(),
    rateOverride: z.number().min(0).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })
  .refine((d) => !d.complimentary || !!d.compReason, {
    message: "A complimentary stay needs a reason",
    path: ["compReason"],
  });

export const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("checkIn") }),
  z.object({
    action: z.literal("checkOut"),
    billedNights: z.number().int().min(1).optional(),
  }),
  z.object({
    action: z.literal("cancel"),
    reason: z.string().trim().min(1, "A cancellation reason is required").max(200),
  }),
  z.object({ action: z.literal("noShow"), reason: z.string().trim().max(200).optional() }),
  z.object({
    action: z.literal("changeDates"),
    checkIn: dateString.optional(),
    checkOut: dateString,
  }),
  z.object({
    action: z.literal("changeRoom"),
    roomId: z.string().min(1, "Pick a room"),
    reason: z.string().trim().min(1, "A reason is required").max(200),
  }),
  z.object({
    action: z.literal("adjustNights"),
    billedNights: z.number().int().min(1),
    reason: z.string().trim().min(1, "A reason is required").max(200),
  }),
]);

export const paymentCreateSchema = z.object({
  amount: z.number().refine((v) => v !== 0, "Amount cannot be zero"),
  method: z.enum(["CASH", "BANK_TRANSFER", "GCASH", "CHECK", "CHARGE_TO_DEPARTMENT", "OTHER"]),
  payerId: z.string().optional(),
  orNumber: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  paidAt: z.string().optional(),
});

export const adjustmentCreateSchema = z.object({
  kind: z.enum(["DISCOUNT", "CHARGE"]),
  amount: z.number().min(0.01, "Amount must be greater than zero"),
  reason: z.string().trim().min(1, "A reason is required").max(200),
});

export const roomCreateSchema = z.object({
  name: z.string().trim().min(1, "Room name is required").max(60),
  rate: z.number().min(0).default(0),
  capacity: z.number().int().min(1).max(20).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const roomUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  rate: z.number().min(0).optional(),
  capacity: z.number().int().min(1).max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  outOfService: z.boolean().optional(),
  needsCleaning: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const roomBlockSchema = z
  .object({
    roomId: z.string().min(1),
    fromDate: dateString,
    toDate: dateString,
    reason: z.string().trim().min(1, "A reason is required").max(200),
  })
  .refine((d) => d.toDate > d.fromDate, {
    message: "The block must end after it starts",
    path: ["toDate"],
  });

export const receivableSettleSchema = z.object({
  paymentIds: z.array(z.string().min(1)).min(1, "Pick at least one charge to settle"),
});

export const periodLockSchema = z.object({
  lockedThrough: dateString.nullable(),
});
