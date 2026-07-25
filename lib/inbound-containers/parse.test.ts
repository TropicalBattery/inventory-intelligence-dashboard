import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  isSupplierHeaderRow,
  parseInboundContainersSheet,
  pickInboundWorksheet,
} from "@/lib/inbound-containers/parse";

function buildSampleWorkbook(): XLSX.WorkBook {
  const rows = [
    ["Expected Containers/Pallets For JULY 2026"],
    [],
    [],
    [
      "SUPPLIER / INVOICE",
      "QUOTE REF",
      "CNTR",
      "",
      "SIZE",
      "ETA PORT",
      "ETA WHSE",
      "BL#",
      "CONTAINER #",
    ],
    ["YIGIT AKU"],
    [
      "INV-100",
      "Q-1",
      2,
      "",
      "40FT",
      "2026-07-15",
      "TBA",
      "BL-1",
      "MSCU1234567",
    ],
    [
      "INV-101",
      "Q-2",
      1,
      "",
      "20FT",
      "TBA",
      "2026-07-20",
      "BL-2",
      "TCLU7654321",
    ],
    ["Total Yigit"],
    [],
    ["Freezetone Products"],
    [
      "FZ-9",
      "FQ-3",
      3,
      "",
      "40FT",
      "2026-08-01",
      "2026-08-05",
      "BL-3",
      "HLCU111",
    ],
    ["", "", "", "", 1],
    ["Total Freezetone"],
    [],
    ["Leoch Battery"],
    [
      "LHK-1",
      "LQ-1",
      1,
      "CNTR",
      "20FT",
      "TBA",
      "TBA",
      "BL-4",
      "GESU1",
    ],
    ["", "", "", "", 1],
    ["", "", "Total Containers", "", 13],
    ["", "", "Total Pallets/Boxes", "", "0P"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Containers Expected TBL");
  return wb;
}

describe("inbound containers parse", () => {
  it("detects supplier header rows", () => {
    expect(isSupplierHeaderRow(["YIGIT AKU"])).toBe(true);
    expect(isSupplierHeaderRow(["Freezetone Products"])).toBe(true);
    expect(isSupplierHeaderRow(["INV-100", "Q-1", 2, "", "40FT"])).toBe(false);
    expect(isSupplierHeaderRow(["Total Yigit"])).toBe(false);
  });

  it("parses supplier blocks and extracts mapped columns", () => {
    const wb = buildSampleWorkbook();
    const { name, sheet } = pickInboundWorksheet(wb);
    const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      sheet as XLSX.WorkSheet,
      { header: 1, defval: null, raw: true }
    );

    const result = parseInboundContainersSheet(matrix, name);

    expect(result.sheetName).toBe("Containers Expected TBL");
    expect(result.sourceMonth).toBe("JULY 2026");
    expect(result.rows).toHaveLength(4);
    expect(result.skippedRows).toBeGreaterThan(0);
    expect(result.rows.every((r) => Boolean(r.supplierInvoice))).toBe(true);

    expect(result.rows[0]).toMatchObject({
      supplier: "YIGIT AKU",
      supplierInvoice: "INV-100",
      quoteRef: "Q-1",
      containerCount: 2,
      containerSize: "40FT",
      etaPort: "2026-07-15",
      etaWarehouse: "TBA",
      blNumber: "BL-1",
      containerNumbers: "MSCU1234567",
      sourceMonth: "JULY 2026",
    });

    expect(result.rows[2]).toMatchObject({
      supplier: "Freezetone Products",
      containerCount: 3,
      containerSize: "40FT",
    });

    expect(result.rows[3]).toMatchObject({
      supplier: "Leoch Battery",
      supplierInvoice: "LHK-1",
      containerCount: 1,
      containerSize: "20FT",
    });
  });

  it("skips supplier subtotals and pallet totals with empty invoice", () => {
    const result = parseInboundContainersSheet(
      [
        ["Expected Containers For JULY 2026"],
        ["YIGIT AKU"],
        ["INV-1", "Q-1", 2, "CNTR", "20FT"],
        ["", "", "", "", 11],
        ["FREEZETONE PRODUCTS"],
        ["INV-2", "Q-2", 1, "CNTR", "40FT"],
        ["", "", "", "", 1],
        ["LEOCH BATTERY"],
        ["INV-3", "Q-3", 1, "CNTR", "20FT"],
        ["", "", "", "", 1],
        ["", "", "Total Containers", "", 13],
        ["", "", "Total Pallets/Boxes", "", "0P"],
      ],
      "Containers Expected TBL"
    );

    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((r) => r.supplierInvoice)).toEqual([
      "INV-1",
      "INV-2",
      "INV-3",
    ]);
    expect(result.skippedRows).toBeGreaterThanOrEqual(5);
  });

  it("falls back to the first sheet when preferred name is missing", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["Expected Containers For AUGUST 2026"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
    const picked = pickInboundWorksheet(wb);
    expect(picked.name).toBe("Sheet1");
  });
});
