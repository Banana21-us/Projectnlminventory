import type { Item, Movement } from "./types";

interface Db {
  items: Item[];
  movements: Movement[];
}

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function seed(): Db {
  const items: Item[] = [
    { id: "i01", location: "Central Storeroom", frequent: true, name: "Rice, 25 kg bag", category: "CONSUMABLE", shelf: "A1-01", stock: 34, maxStock: 60, unit: "bags" },
    { id: "i02", location: "Central Storeroom", name: "Cooking oil, 5 L", category: "PERISHABLE", shelf: "A1-03", stock: 7, maxStock: 24, unit: "jugs", expiry: iso(160) },
    { id: "i03", location: "Central Storeroom", name: "Powdered milk, 900 g", category: "PERISHABLE", shelf: "A2-02", stock: 3, maxStock: 20, unit: "tins", expiry: iso(38) },
    { id: "i04", location: "Central Storeroom", name: "Canned beans", category: "PERISHABLE", shelf: "A2-05", stock: 96, maxStock: 140, unit: "cans", expiry: iso(240) },
    { id: "i05", location: "Clinic Store", frequent: true, name: "Paracetamol 500 mg", category: "PERISHABLE", shelf: "B1-02", stock: 9, maxStock: 40, unit: "boxes", expiry: iso(21) },
    { id: "i06", location: "Clinic Store", name: "Bandage rolls", category: "CONSUMABLE", shelf: "B1-04", stock: 58, maxStock: 80, unit: "rolls" },
    { id: "i07", location: "Clinic Store", name: "Oral rehydration salts", category: "PERISHABLE", shelf: "B1-06", stock: 0, maxStock: 100, unit: "sachets", expiry: iso(300) },
    { id: "i08", location: "Clinic Store", frequent: true, name: "First aid kit", category: "ASSET", shelf: "B2-01", stock: 6, maxStock: 10, unit: "kits" },
    { id: "i09", location: "Central Storeroom", frequent: true, name: "Bar soap", category: "CONSUMABLE", shelf: "C1-01", stock: 74, maxStock: 120, unit: "bars" },
    { id: "i10", location: "Central Storeroom", name: "Toothbrush kits", category: "CONSUMABLE", shelf: "C1-03", stock: 12, maxStock: 50, unit: "kits" },
    { id: "i11", location: "Clinic Store", name: "Sanitary pads", category: "CONSUMABLE", shelf: "C1-05", stock: 4, maxStock: 40, unit: "packs" },
    { id: "i12", location: "School Store", frequent: true, name: "Exercise books", category: "CONSUMABLE", shelf: "C2-02", stock: 260, maxStock: 400, unit: "books" },
    { id: "i13", location: "School Store", name: "Pencils, HB", category: "CONSUMABLE", shelf: "C2-03", stock: 41, maxStock: 60, unit: "boxes" },
    { id: "i14", location: "Outstation Depot", frequent: true, name: "Mosquito nets", category: "ASSET", shelf: "D1-02", stock: 18, maxStock: 30, unit: "nets" },
    { id: "i15", location: "Central Storeroom", name: "Solar lantern", category: "ASSET", shelf: "D1-04", stock: 2, maxStock: 12, unit: "units" },
    { id: "i16", location: "Outstation Depot", name: "Tarpaulin, 4×6 m", category: "ASSET", shelf: "D2-01", stock: 8, maxStock: 10, unit: "sheets" },
    { id: "i17", location: "Outstation Depot", name: "Water filter", category: "ASSET", shelf: "D2-03", stock: 11, maxStock: 15, unit: "units" },
    { id: "i18", location: "Central Storeroom", name: "Songbooks", category: "CONSUMABLE", shelf: "E1-01", stock: 120, maxStock: 150, unit: "copies" },
  ];

  const movements: Movement[] = [
    {
      id: "m1",
      type: "OUT",
      itemId: "i09",
      itemName: "Bar soap",
      shelf: "C1-01",
      qty: 12,
      unit: "bars",
      issuedTo: "Outreach Team",
      staff: "Naomi K.",
      at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    },
    {
      id: "m2",
      type: "IN",
      itemId: "i01",
      itemName: "Rice, 25 kg bag",
      shelf: "A1-01",
      qty: 20,
      unit: "bags",
      staff: "Daniel O.",
      at: new Date(Date.now() - 26 * 3600_000).toISOString(),
    },
    {
      id: "m3",
      type: "OUT",
      itemId: "i12",
      itemName: "Exercise books",
      shelf: "C2-02",
      qty: 40,
      unit: "books",
      issuedTo: "School",
      staff: "Naomi K.",
      at: new Date(Date.now() - 30 * 3600_000).toISOString(),
    },
    {
      id: "m4",
      type: "OUT",
      itemId: "i14",
      itemName: "Mosquito nets",
      shelf: "D1-02",
      qty: 6,
      unit: "nets",
      issuedTo: "Guest House",
      staff: "Daniel O.",
      at: new Date(Date.now() - 50 * 3600_000).toISOString(),
    },
  ];

  return { items, movements };
}

// Persist across dev HMR / route-module reloads.
const g = globalThis as unknown as { __missionDb?: Db };

export function db(): Db {
  g.__missionDb ??= seed();
  return g.__missionDb;
}
