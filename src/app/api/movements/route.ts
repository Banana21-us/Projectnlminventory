import { db } from "@/lib/db";
import { CURRENT_USER } from "@/lib/session";
import type { Movement } from "@/lib/types";

export async function GET() {
  const movements = [...db().movements].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  return Response.json(movements);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    (body.type !== "OUT" && body.type !== "IN") ||
    typeof body.itemId !== "string" ||
    !Number.isFinite(body.qty) ||
    body.qty <= 0
  ) {
    return Response.json({ error: "Invalid movement payload" }, { status: 400 });
  }

  const store = db();
  const item = store.items.find((i) => i.id === body.itemId);
  if (!item) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  const qty = Math.floor(body.qty);
  if (body.type === "OUT") {
    if (item.stock < qty) {
      return Response.json(
        { error: `Only ${item.stock} ${item.unit} of ${item.name} remaining` },
        { status: 409 },
      );
    }
    item.stock -= qty;
  } else {
    item.stock += qty;
  }

  const movement: Movement = {
    id: `m${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type: body.type,
    itemId: item.id,
    itemName: item.name,
    shelf: item.shelf,
    qty,
    unit: item.unit,
    ...(typeof body.issuedTo === "string" && body.issuedTo.trim()
      ? { issuedTo: body.issuedTo.trim() }
      : {}),
    staff: CURRENT_USER.name,
    at: new Date().toISOString(),
  };
  store.movements.unshift(movement);

  return Response.json(movement, { status: 201 });
}
