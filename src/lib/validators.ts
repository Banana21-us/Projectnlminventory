import { z } from "zod";

// FormRequest-style schemas: one per endpoint, validated in the DAL.

export const itemCreateSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(120),
  categoryId: z.string().min(1, "Category is required"),
  stockroomId: z.string().min(1, "Stockroom is required"),
  shelf: z.string().trim().min(1, "Shelf code is required").max(20),
  unit: z.string().trim().min(1, "Unit is required").max(30),
  stock: z.number().int().min(0),
  maxStock: z.number().int().min(1, "Par level must be at least 1"),
  sellingPrice: z.number().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  description: z.string().trim().max(500).optional(),
  frequent: z.boolean().optional(),
});

export const itemBulkSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1, "Select at least one item"),
    action: z.enum(["adjust", "transfer", "writeOff"]),
    delta: z.number().int().optional(),
    stockroomId: z.string().optional(),
  })
  .refine((v) => v.action !== "adjust" || (v.delta !== undefined && v.delta !== 0), {
    message: "Adjustment amount is required",
    path: ["delta"],
  })
  .refine((v) => v.action !== "transfer" || !!v.stockroomId, {
    message: "Target stockroom is required",
    path: ["stockroomId"],
  });

export const movementCreateSchema = z
  .object({
    stockId: z.string().min(1, "Item is required"),
    type: z.enum(["RECEIVE", "DISPENSE", "SALE"]),
    qty: z.number().int().min(1, "Quantity must be at least 1"),
    purpose: z
      .enum(["FREE_BAPTISMAL", "PASTOR_ISSUE", "OFFICE_USE", "GUESTHOUSE", "DONATION", "OTHER"])
      .optional(),
    issuedTo: z.string().trim().max(120).optional(),
    recipientId: z.string().optional(),
    unitCost: z.number().min(0).optional(),
    unitPrice: z.number().min(0).optional(),
    orNumber: z.string().trim().max(40).optional(),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.type !== "SALE" || v.unitPrice !== undefined, {
    message: "Unit price is required for sales",
    path: ["unitPrice"],
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
  signature: z.string().startsWith("data:image/png"),
});
