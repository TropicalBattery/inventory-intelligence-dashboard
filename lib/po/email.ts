import { Resend } from "resend";
import {
  getInternalPoRecipientEmail,
  getPoCompanyName,
  getPoFromEmail,
  getResendApiKey,
} from "@/lib/po/config";
import type { PurchaseOrderDocument } from "@/lib/types";

export type SendPurchaseOrderEmailResult = {
  success: boolean;
  error?: string;
  recipients?: string[];
};

export async function sendPurchaseOrderEmail(
  po: PurchaseOrderDocument,
  pdfBytes: Uint8Array
): Promise<SendPurchaseOrderEmailResult> {
  const apiKey = getResendApiKey();
  const fromEmail = getPoFromEmail();

  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  if (!fromEmail) {
    return { success: false, error: "PO_FROM_EMAIL is not configured" };
  }

  const recipients = [
    po.supplierEmail,
    getInternalPoRecipientEmail(),
  ].filter((email): email is string => Boolean(email && email.trim()));

  if (recipients.length === 0) {
    return {
      success: false,
      error: "No recipient email addresses configured for this purchase order",
    };
  }

  const companyName = getPoCompanyName();
  const totalFormatted = (po.totalAmount ?? 0).toLocaleString("en-JM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const totalLabel = po.hasUnknownLineCosts
    ? `Partial total (some costs unavailable): J$${totalFormatted}`
    : `Total: J$${totalFormatted}`;

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: recipients,
    subject: `Purchase Order ${po.poNumber}`,
    text: `Please find attached Purchase Order ${po.poNumber} from ${companyName}. ${totalLabel}.`,
    attachments: [
      {
        filename: `${po.poNumber}.pdf`,
        content: Buffer.from(pdfBytes),
      },
    ],
  });

  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to send purchase order email",
    };
  }

  return { success: true, recipients };
}
