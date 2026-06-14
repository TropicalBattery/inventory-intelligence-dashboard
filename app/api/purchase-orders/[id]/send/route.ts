import { NextResponse } from "next/server";
import { sendPurchaseOrderEmail } from "@/lib/po/email";
import { buildPurchaseOrderPdf } from "@/lib/po/pdf-document";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPurchaseOrderDocumentWithReferenceDetails } from "@/lib/queries/purchase-orders";
import { TENANT_ID } from "@/lib/tenant";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  const purchaseOrder = await getPurchaseOrderDocumentWithReferenceDetails(
    context.params.id
  );

  if (!purchaseOrder) {
    return NextResponse.json(
      { error: "Purchase order not found" },
      { status: 404 }
    );
  }

  if (purchaseOrder.status === "sent") {
    return NextResponse.json(
      { error: "Purchase order has already been sent" },
      { status: 400 }
    );
  }

  if (!purchaseOrder.supplierEmail) {
    return NextResponse.json(
      {
        error:
          "No supplier email on file. Add supplier contact details via Reference Data.",
      },
      { status: 400 }
    );
  }

  const pdfBytes = await buildPurchaseOrderPdf(purchaseOrder);
  const emailResult = await sendPurchaseOrderEmail(purchaseOrder, pdfBytes);

  if (!emailResult.success) {
    return NextResponse.json(
      { error: emailResult.error ?? "Failed to send purchase order email" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();
  const sentAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      status: "sent",
      sent_at: sentAt,
      source_updated_at: sentAt,
    })
    .eq("tenant_id", TENANT_ID)
    .eq("id", context.params.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Email sent but status update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    recipients: emailResult.recipients,
    sentAt,
  });
}
