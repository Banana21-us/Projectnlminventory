import { api, requireCan, ApiError } from "@/lib/dal";
import { buildCountSheet } from "@/lib/count-sheet";
import type { CountSheetRow, CountSheetTotals } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = api(async (request) => {
  await requireCan("reports.view");
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new ApiError(422, "from and to dates (YYYY-MM-DD) are required");
  }

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1);
  if (start >= end) throw new ApiError(422, "'from' must be before 'to'");

  const rows: CountSheetRow[] = await buildCountSheet(start, end);
  const totals: CountSheetTotals = {
    rowCount: rows.length,
    beginning: rows.reduce((s, r) => s + r.beginning, 0),
    inQty: rows.reduce((s, r) => s + r.inQty, 0),
    outQty: rows.reduce((s, r) => s + r.outQty, 0),
    returnedQty: rows.reduce((s, r) => s + r.returnedQty, 0),
    writeOffQty: rows.reduce((s, r) => s + r.writeOffQty, 0),
    ending: rows.reduce((s, r) => s + r.ending, 0),
  };

  return Response.json({ rows, totals });
});
