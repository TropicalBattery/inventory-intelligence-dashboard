import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildPurchaseOrderPdf } from "@/lib/po/pdf-document";
import type { PurchaseOrderDocument } from "@/lib/types";

const samplePo: PurchaseOrderDocument = {
  id: "test-po-id",
  poNumber: "PO-TB-20260613-TEST",
  poDate: "2026-06-13T12:00:00.000Z",
  status: "draft",
  totalAmount: 0,
  hasUnknownLineCosts: true,
  memo:
    "Here is a draft cover note for the purchase order:\n\nThis purchase order has been raised to replenish fast-moving inventory ahead of expected demand.",
  sentAt: null,
  supplierExternalId: "FK020",
  supplierName: "FK020",
  supplierEmail: null,
  supplierAddress: null,
  lines: [
    {
      sku: "SKU-TEST-001",
      vendorItemNumber: "VEND-123",
      description: "Test battery SKU for PDF verification",
      quantityOrdered: 12,
      unitCost: null,
      lineTotal: null,
    },
  ],
};

describe("buildPurchaseOrderPdf", () => {
  it("generates a non-empty PDF with expected PO content", async () => {
    const pdfBytes = await buildPurchaseOrderPdf(samplePo);

    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8")).toBe("%PDF");

    const outputDir = path.join(process.cwd(), "test-output");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${samplePo.poNumber}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});
