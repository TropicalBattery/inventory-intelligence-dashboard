import { NextResponse } from "next/server";
import { buildPurchaseOrderPdf } from "@/lib/po/pdf-document";
import { getPurchaseOrderDocumentWithReferenceDetails } from "@/lib/queries/purchase-orders";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  const purchaseOrder = await getPurchaseOrderDocumentWithReferenceDetails(
    context.params.id
  );

  if (!purchaseOrder) {
    return NextResponse.json(
      { error: "Purchase order not found" },
      { status: 404 }
    );
  }

  const pdfBytes = await buildPurchaseOrderPdf(purchaseOrder);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${purchaseOrder.poNumber}.pdf"`,
    },
  });
}
