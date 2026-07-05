import { renderToBuffer } from "@react-pdf/renderer";
import { api, requireCan, validate } from "@/lib/dal";
import { MovementReceiptDocument } from "@/lib/pdf/movement-receipt";
import type { Movement } from "@/lib/types";
import { movementReceiptPdfSchema } from "@/lib/validators";

export const POST = api(async (request) => {
  await requireCan("movements.view");
  const data = await validate(request, movementReceiptPdfSchema);
  const { signature, ...movement } = data;

  const buffer = await renderToBuffer(
    MovementReceiptDocument({ movement: movement as unknown as Movement, signature }),
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nlm-receipt-${movement.id}.pdf"`,
    },
  });
});
