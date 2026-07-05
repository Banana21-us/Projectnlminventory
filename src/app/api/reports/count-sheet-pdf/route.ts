import { renderToBuffer } from "@react-pdf/renderer";
import { api, requireCan } from "@/lib/dal";
import { toItemDto } from "@/lib/dto";
import { CountSheetDocument } from "@/lib/pdf/count-sheet-report";
import { prisma } from "@/lib/prisma";

const STOCK_INCLUDE = {
  item: { include: { category: true } },
  stockroom: true,
} as const;

export const GET = api(async () => {
  const user = await requireCan("reports.view");
  const rows = await prisma.itemStock.findMany({
    where: { item: { active: true }, stockroom: { active: true } },
    include: STOCK_INCLUDE,
    orderBy: [{ stockroom: { name: "asc" } }, { shelf: "asc" }],
  });
  const items = rows.map((r) => toItemDto(r, { withPricing: false }));

  const buffer = await renderToBuffer(CountSheetDocument({ items, generatedBy: user.name }));
  const today = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nlm-count-sheet-${today}.pdf"`,
    },
  });
});
