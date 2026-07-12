import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { applyStockAction } from "../src/lib/stock"
import { prisma } from "../src/lib/prisma"

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function main() {
  // ── Default accounts (change these passwords after first login) ──
  const users = [
    { name: "Admin", email: "admin@nlm.org", password: "admin123", role: "ADMIN" as const },
    { name: "Staff", email: "staff@nlm.org", password: "staff123", role: "STAFF" as const },
    { name: "Guesthouse", email: "guest@nlm.org", password: "guest123", role: "GUESTHOUSE" as const },
  ]
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        password: await bcrypt.hash(u.password, 12),
        role: u.role,
        mustChangePassword: true,
      },
    })
  }

  // ── Stockrooms ──
  const stockroomNames = ["Main Storeroom", "Publishing Room"]
  const stockrooms: Record<string, string> = {}
  for (const name of stockroomNames) {
    const s = await prisma.stockroom.upsert({ where: { name }, update: {}, create: { name } })
    stockrooms[name] = s.id
  }

  // ── Categories ──
  const categoryDefs = [
    { name: "Bible Books", type: "BOOK" as const },
    { name: "Baptismal Materials", type: "MATERIAL" as const },
    { name: "Office Supplies", type: "SUPPLY" as const },
    { name: "Equipment", type: "ASSET" as const },
  ]
  const categories: Record<string, string> = {}
  for (const c of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    })
    categories[c.name] = cat.id
  }

  // ── Sample districts (replace with the real NLM district list) ──
  const districtNames = ["District 1", "District 2", "District 3"]
  const districts: Record<string, string> = {}
  for (const name of districtNames) {
    const d = await prisma.district.upsert({ where: { name }, update: {}, create: { name } })
    districts[name] = d.id
  }

  // ── Sample recipients for the dispense recipient picker ──
  // (Department / Pastor / Guest tabs — replace with real names.)
  const recipientDefs: { name: string; type: "DEPARTMENT" | "PASTOR" | "GUESTHOUSE"; district?: string }[] = [
    { name: "Education Department", type: "DEPARTMENT" },
    { name: "Health Ministries Department", type: "DEPARTMENT" },
    { name: "Church Ministries Department", type: "DEPARTMENT" },
    { name: "Pastor Juan Dela Cruz", type: "PASTOR", district: "District 1" },
    { name: "Pastor Maria Santos", type: "PASTOR", district: "District 2" },
    { name: "Pastor Pedro Reyes", type: "PASTOR", district: "District 3" },
    { name: "Guesthouse Front Desk", type: "GUESTHOUSE" },
  ]
  for (const r of recipientDefs) {
    const existing = await prisma.recipient.findFirst({ where: { name: r.name, type: r.type } })
    if (existing) continue
    await prisma.recipient.create({
      data: {
        name: r.name,
        type: r.type,
        ...(r.district ? { districtId: districts[r.district] } : {}),
      },
    })
  }

  // ── Sample items so the app isn't empty on first run ──
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@nlm.org" } })

  interface BatchSpec {
    qty: number
    batchCode: string
    expiry?: string
    serials?: string[]
  }
  interface ItemSpec {
    name: string
    model?: string
    category: string
    stockroom: string
    shelf: string
    unit: string
    maxStock: number
    cost: number
    price: number
    frequent?: boolean
    serialized?: boolean
    batches: BatchSpec[]
  }

  const sampleItems: ItemSpec[] = [
    {
      name: "Steps to Christ",
      model: "Pocket edition",
      category: "Bible Books",
      stockroom: "Publishing Room",
      shelf: "A1-01",
      unit: "copies",
      maxStock: 200,
      cost: 35,
      price: 60,
      frequent: true,
      batches: [{ qty: 120, batchCode: "STC-2024" }],
    },
    {
      name: "Baptismal Certificate",
      category: "Baptismal Materials",
      stockroom: "Main Storeroom",
      shelf: "B1-02",
      unit: "pcs",
      maxStock: 500,
      cost: 5,
      price: 0,
      frequent: true,
      // Two lots with different expiries — demonstrates FEFO: the near-dated
      // lot drains first even though the far lot was received later.
      batches: [
        { qty: 90, batchCode: "BC-LOT-8841", expiry: daysFromNow(40) },
        { qty: 210, batchCode: "BC-LOT-9102", expiry: daysFromNow(300) },
      ],
    },
    {
      name: "Bond Paper A4",
      category: "Office Supplies",
      stockroom: "Main Storeroom",
      shelf: "C1-01",
      unit: "reams",
      maxStock: 40,
      cost: 220,
      price: 0,
      batches: [{ qty: 25, batchCode: "PAPER-2606" }],
    },
    {
      name: "Data Projector",
      model: "Epson EB-X06",
      category: "Equipment",
      stockroom: "Main Storeroom",
      shelf: "D1-01",
      unit: "units",
      maxStock: 6,
      cost: 18000,
      price: 0,
      serialized: true,
      batches: [{ qty: 3, batchCode: "PROJ-2605", serials: ["EPX06-001", "EPX06-002", "EPX06-003"] }],
    },
  ]

  for (const s of sampleItems) {
    const existing = await prisma.item.findFirst({ where: { name: s.name } })
    if (existing) continue
    const item = await prisma.item.create({
      data: {
        name: s.name,
        model: s.model,
        categoryId: categories[s.category],
        unit: s.unit,
        sellingPrice: new Prisma.Decimal(s.price),
        avgCost: new Prisma.Decimal(s.cost),
        frequent: s.frequent ?? false,
        serialized: s.serialized ?? false,
      },
    })
    const stock = await prisma.itemStock.create({
      data: {
        itemId: item.id,
        stockroomId: stockrooms[s.stockroom],
        shelf: s.shelf,
        quantity: 0,
        maxStock: s.maxStock,
      },
    })
    for (const b of s.batches) {
      await applyStockAction({
        stockId: stock.id,
        userId: admin.id,
        qty: b.qty,
        type: "RECEIVE",
        unitCost: s.cost,
        reference: "Opening stock",
        batchCode: b.batchCode,
        expiry: b.expiry,
        serials: b.serials,
      })
    }
  }

  // ── Guesthouse rooms ──
  for (const name of ["Room 1", "Room 2", "Room 3"]) {
    await prisma.room.upsert({ where: { name }, update: {}, create: { name } })
  }

  console.log("Seeded users, stockrooms, categories, districts, sample items, rooms")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
