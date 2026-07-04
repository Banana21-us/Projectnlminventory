import { PrismaClient, Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

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
  const sampleItems = [
    {
      name: "Steps to Christ",
      category: "Bible Books",
      stockroom: "Publishing Room",
      shelf: "A1-01",
      unit: "copies",
      qty: 120,
      maxStock: 200,
      cost: 35,
      price: 60,
      frequent: true,
    },
    {
      name: "Baptismal Certificate",
      category: "Baptismal Materials",
      stockroom: "Main Storeroom",
      shelf: "B1-02",
      unit: "pcs",
      qty: 300,
      maxStock: 500,
      cost: 5,
      price: 0,
      frequent: true,
    },
    {
      name: "Bond Paper A4",
      category: "Office Supplies",
      stockroom: "Main Storeroom",
      shelf: "C1-01",
      unit: "reams",
      qty: 25,
      maxStock: 40,
      cost: 220,
      price: 0,
      frequent: false,
    },
  ]
  for (const s of sampleItems) {
    const existing = await prisma.item.findFirst({ where: { name: s.name } })
    if (existing) continue
    const item = await prisma.item.create({
      data: {
        name: s.name,
        categoryId: categories[s.category],
        unit: s.unit,
        sellingPrice: new Prisma.Decimal(s.price),
        avgCost: new Prisma.Decimal(s.cost),
        frequent: s.frequent,
      },
    })
    await prisma.itemStock.create({
      data: {
        itemId: item.id,
        stockroomId: stockrooms[s.stockroom],
        shelf: s.shelf,
        quantity: s.qty,
        maxStock: s.maxStock,
      },
    })
    await prisma.movement.create({
      data: {
        itemId: item.id,
        stockroomId: stockrooms[s.stockroom],
        userId: admin.id,
        type: "RECEIVE",
        qty: s.qty,
        unitCost: new Prisma.Decimal(s.cost),
        reference: "Opening stock",
      },
    })
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
