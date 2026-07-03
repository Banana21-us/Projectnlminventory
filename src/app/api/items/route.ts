import { db } from "@/lib/db";
import { CURRENT_USER, canManageInventory } from "@/lib/session";
import { CATEGORIES, LOCATIONS, type Item, type Location } from "@/lib/types";

export async function GET() {
  return Response.json(db().items);
}

export async function POST(request: Request) {
  if (!canManageInventory(CURRENT_USER.role)) {
    return Response.json({ error: "Not permitted" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    !CATEGORIES.includes(body.category) ||
    !LOCATIONS.includes(body.location) ||
    typeof body.shelf !== "string" ||
    !body.shelf.trim() ||
    !Number.isFinite(body.stock) ||
    body.stock < 0 ||
    !Number.isFinite(body.maxStock) ||
    body.maxStock <= 0 ||
    typeof body.unit !== "string" ||
    !body.unit.trim()
  ) {
    return Response.json({ error: "Invalid item payload" }, { status: 400 });
  }

  const store = db();
  const item: Item = {
    id: `i${Date.now().toString(36)}`,
    name: body.name.trim(),
    category: body.category,
    shelf: body.shelf.trim().toUpperCase(),
    location: body.location,
    stock: Math.floor(body.stock),
    maxStock: Math.floor(body.maxStock),
    unit: body.unit.trim(),
    ...(typeof body.expiry === "string" && body.expiry ? { expiry: body.expiry } : {}),
  };
  store.items.push(item);

  if (item.stock > 0) {
    store.movements.unshift({
      id: `m${Date.now().toString(36)}`,
      type: "IN",
      itemId: item.id,
      itemName: item.name,
      shelf: item.shelf,
      qty: item.stock,
      unit: item.unit,
      staff: CURRENT_USER.name,
      at: new Date().toISOString(),
    });
  }

  return Response.json(item, { status: 201 });
}

// Bulk actions: adjust stock, transfer location, mark expired.
export async function PATCH(request: Request) {
  if (!canManageInventory(CURRENT_USER.role)) {
    return Response.json({ error: "Not permitted" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  const action: unknown = body?.action;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === "string") ||
    !["adjust", "transfer", "expire"].includes(action as string)
  ) {
    return Response.json({ error: "Invalid bulk payload" }, { status: 400 });
  }

  const store = db();
  const targets = store.items.filter((i) => (ids as string[]).includes(i.id));
  if (targets.length === 0) {
    return Response.json({ error: "No matching items" }, { status: 404 });
  }

  const now = () => new Date().toISOString();
  const mid = () =>
    `m${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  if (action === "adjust") {
    const delta = Math.trunc(Number(body.delta));
    if (!Number.isFinite(delta) || delta === 0) {
      return Response.json({ error: "Invalid adjustment amount" }, { status: 400 });
    }
    for (const item of targets) {
      const applied = delta < 0 ? -Math.min(item.stock, -delta) : delta;
      if (applied === 0) continue;
      item.stock += applied;
      store.movements.unshift({
        id: mid(),
        type: applied > 0 ? "IN" : "OUT",
        itemId: item.id,
        itemName: item.name,
        shelf: item.shelf,
        qty: Math.abs(applied),
        unit: item.unit,
        issuedTo: "Stock adjustment",
        staff: CURRENT_USER.name,
        at: now(),
      });
    }
  } else if (action === "transfer") {
    const location = body.location as Location;
    if (!LOCATIONS.includes(location)) {
      return Response.json({ error: "Invalid location" }, { status: 400 });
    }
    for (const item of targets) item.location = location;
  } else {
    // expire: write off remaining stock
    for (const item of targets) {
      if (item.stock > 0) {
        store.movements.unshift({
          id: mid(),
          type: "OUT",
          itemId: item.id,
          itemName: item.name,
          shelf: item.shelf,
          qty: item.stock,
          unit: item.unit,
          issuedTo: "Expired write-off",
          staff: CURRENT_USER.name,
          at: now(),
        });
        item.stock = 0;
      }
    }
  }

  return Response.json(targets);
}
