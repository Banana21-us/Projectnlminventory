import { api, requireCan, ApiError } from "@/lib/dal";
import { buildCountSheet } from "@/lib/count-sheet";

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

  return Response.json(await buildCountSheet(start, end));
});
