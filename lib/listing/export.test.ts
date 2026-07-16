import { describe, expect, it } from "vitest";
import {
  buildDatedExportFilename,
  buildExportCsv,
  formatExportValue,
} from "@/lib/listing/export";

describe("formatExportValue", () => {
  it("never emits NaN or raw nulls", () => {
    expect(formatExportValue(null)).toBe("-");
    expect(formatExportValue(undefined)).toBe("-");
    expect(formatExportValue(Number.NaN)).toBe("-");
    expect(formatExportValue(Number.POSITIVE_INFINITY)).toBe("-");
    expect(formatExportValue("")).toBe("-");
    expect(formatExportValue(12)).toBe("12");
    expect(formatExportValue("ok")).toBe("ok");
  });
});

describe("buildExportCsv", () => {
  it("writes headers and sanitized cells", () => {
    const csv = buildExportCsv(
      [
        { key: "sku", header: "SKU" },
        { key: "qty", header: "Qty", align: "right" },
      ],
      [
        { sku: "A1", qty: 3 },
        { sku: "B2", qty: Number.NaN },
      ]
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("SKU,Qty");
    expect(csv).toContain("A1,3");
    expect(csv).toContain("B2,-");
  });
});

describe("buildDatedExportFilename", () => {
  it("stamps the prefix and format", () => {
    expect(
      buildDatedExportFilename(
        "overstock",
        "pdf",
        new Date("2026-07-16T12:00:00.000Z")
      )
    ).toBe("overstock-2026-07-16.pdf");
  });
});
