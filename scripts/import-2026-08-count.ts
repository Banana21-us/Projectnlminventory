// One-off import of the physical count sheet (2026-08-26).
// Blank/"-" prices become 0. Item names, quantities and locations are kept
// literal to the source sheet — no merging/splitting of dual-location rows.
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { applyStockAction } from "../src/lib/stock";

interface Row {
  name: string;
  qty: number;
  price: number; // 0 = blank/"-" on the sheet
  category: string; // Category.name
  stockroom: string; // Stockroom.name
  unit: string;
}

const ROWS: Row[] = [
  { name: "Hymnal (Eng-Ilo)", qty: 6, price: 450, category: "Song", stockroom: "2F Stockroom", unit: "copies" },
  { name: "Bible KJV (Eng)", qty: 123, price: 500, category: "Bible", stockroom: "2F Stockroom", unit: "copies" },
  { name: "Bible KJV (Ilo)", qty: 1480, price: 500, category: "Bible", stockroom: "2F Stockroom", unit: "copies" },
  { name: "Bible KJV (Tag)", qty: 1241, price: 500, category: "Bible", stockroom: "2F Stockroom", unit: "copies" },
  { name: "Bible Story", qty: 9, price: 2150, category: "Bible", stockroom: "2F Stockroom", unit: "copies" },
  { name: "Sleeping Bag", qty: 9, price: 0, category: "Supplies", stockroom: "2F Stockroom", unit: "pcs" },
  { name: "Pag Asang Daig ang Bukas", qty: 259, price: 0, category: "Ilocano", stockroom: "2F Stockroom/Garage Stockroom", unit: "copies" },
  { name: "Youth Bible ESV", qty: 545, price: 500, category: "Bible", stockroom: "2F Stockroom/Lower Basement Stockroom", unit: "copies" },
  { name: "Messages to Young People", qty: 84, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "The Ministry of Healing", qty: 84, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Counsels on Stewardship", qty: 84, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Last Day Events", qty: 84, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Ang Dakilang Tunggalian (Damaged)", qty: 1006, price: 85, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "The Great Controversy", qty: 1772, price: 85, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Ti Dakkel a Panagbinnusor", qty: 4569, price: 85, category: "Ilocano", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Hope Beyond Tomorrow", qty: 1913, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Hope for Today's Families (Eng)", qty: 20000, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Hope for Today's Families (Tag)", qty: 400, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Hope for the Troubled Times (Eng)", qty: 1800, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Hope for the Troubled Times (Tag)", qty: 960, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Voice of Prophecy (Eng)", qty: 788, price: 0, category: "EGW Books", stockroom: "Garage Stockroom", unit: "copies" },
  { name: "Ang Dakilang Tunggalian (Good)", qty: 986, price: 85, category: "EGW Books", stockroom: "Lower Basement Stockroom", unit: "copies" },
];

// Stockroom names on the sheet that already exist under a shorter DB name.
const STOCKROOM_ALIASES: Record<string, string> = {
  "Garage Stockroom": "Garage",
};

// New categories the sheet needs that don't already exist.
const NEW_CATEGORIES: { name: string; type: "BOOK" | "MATERIAL" | "SUPPLY" | "ASSET" }[] = [
  { name: "Bible", type: "BOOK" },
  { name: "Supplies", type: "SUPPLY" },
];

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@nlm.org" } });

  for (const c of NEW_CATEGORIES) {
    await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }

  const stockroomNames = new Set(ROWS.map((r) => STOCKROOM_ALIASES[r.stockroom] ?? r.stockroom));
  const stockrooms: Record<string, string> = {};
  for (const name of stockroomNames) {
    const s = await prisma.stockroom.upsert({ where: { name }, update: {}, create: { name } });
    stockrooms[name] = s.id;
  }

  const categories: Record<string, string> = {};
  for (const cat of await prisma.category.findMany()) {
    categories[cat.name] = cat.id;
  }

  let created = 0;
  let skipped = 0;
  for (const row of ROWS) {
    const existing = await prisma.item.findFirst({ where: { name: row.name } });
    if (existing) {
      console.log(`SKIP (already exists): ${row.name}`);
      skipped++;
      continue;
    }
    const stockroomId = stockrooms[STOCKROOM_ALIASES[row.stockroom] ?? row.stockroom];
    const categoryId = categories[row.category];
    if (!stockroomId) throw new Error(`Unknown stockroom for row: ${row.name} (${row.stockroom})`);
    if (!categoryId) throw new Error(`Unknown category for row: ${row.name} (${row.category})`);

    const item = await prisma.item.create({
      data: {
        name: row.name,
        categoryId,
        unit: row.unit,
        sellingPrice: new Prisma.Decimal(row.price),
        avgCost: new Prisma.Decimal(0),
        notes: "Opening count, 2026-08-26",
      },
    });
    const stock = await prisma.itemStock.create({
      data: { itemId: item.id, stockroomId, shelf: "", quantity: 0, maxStock: 0 },
    });
    if (row.qty > 0) {
      await applyStockAction({
        stockId: stock.id,
        userId: admin.id,
        qty: row.qty,
        type: "RECEIVE",
        unitCost: 0,
        reference: "Opening stock (physical count 2026-08-26)",
      });
    }
    console.log(`CREATED: ${row.name} — qty ${row.qty}, price ${row.price}, ${row.stockroom}`);
    created++;
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
