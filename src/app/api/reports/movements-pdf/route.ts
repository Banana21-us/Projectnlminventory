import { renderToBuffer } from "@react-pdf/renderer";
import { api, requireCan, ApiError } from "@/lib/dal";
import { toMovementDto } from "@/lib/dto";
import { MovementsReportDocument } from "@/lib/pdf/movements-report";
import { prisma } from "@/lib/prisma";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = api(async (request) => {
  const user = await requireCan("reports.view");
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

  const rows = await prisma.movement.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: {
      item: { include: { stocks: true, category: true } },
      stockroom: true,
      user: true,
      recipient: { include: { district: true } },
      lines: { include: { batch: true, assetUnit: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const movements = rows.map((m) =>
    toMovementDto(m, m.item.stocks.find((s) => s.stockroomId === m.stockroomId)?.shelf ?? "—"),
  );

  const buffer = await renderToBuffer(
    MovementsReportDocument({ from, to, movements, generatedBy: user.name }),
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nlm-movements-${from}_to_${to}.pdf"`,
    },
  });
});
