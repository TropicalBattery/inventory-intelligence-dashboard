import { describe, expect, it } from "vitest";
import {
  formatEtaLabel,
  normalizeSupplierKey,
  parseEtaPortDate,
  resolveInboundForRecommendation,
  type InboundBySupplierSummary,
} from "@/lib/queries/inbound-by-supplier";

describe("inbound-by-supplier helpers", () => {
  it("normalises supplier names for matching", () => {
    expect(normalizeSupplierKey("  Yigit Aku Corp. ")).toBe("YIGIT AKU CORP");
    expect(normalizeSupplierKey("FREEZETONE PRODUCTS")).toBe(
      "FREEZETONE PRODUCTS"
    );
  });

  it("parses ISO eta_port and ignores TBA", () => {
    expect(parseEtaPortDate("TBA")).toBeNull();
    expect(parseEtaPortDate(null)).toBeNull();
    const d = parseEtaPortDate("2026-07-16");
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(6);
    expect(d?.getUTCDate()).toBe(16);
  });

  it("formats ETA ranges like 16-24 Jul", () => {
    expect(formatEtaLabel([])).toBe("ETA TBA");
    expect(
      formatEtaLabel([
        new Date(Date.UTC(2026, 6, 16, 12)),
        new Date(Date.UTC(2026, 6, 24, 12)),
      ])
    ).toBe("16-24 Jul");
    expect(formatEtaLabel([new Date(Date.UTC(2026, 6, 16, 12))])).toBe(
      "16 Jul"
    );
  });

  it("matches recommendations via alias codes", () => {
    const inbound = new Map<string, InboundBySupplierSummary>([
      [
        "YIGIT AKU",
        {
          containerCount: 11,
          rowCount: 5,
          nextEtaPort: "2026-07-16",
          etaLabel: "16-24 Jul",
          sourceMonth: "JULY 2026",
        },
      ],
    ]);
    const nameMap = new Map<string, string>([["FY060", "Yigit Aku Corp."]]);

    const hit = resolveInboundForRecommendation(
      { supplierName: null, supplierExternalId: "FY060" },
      inbound,
      nameMap
    );
    expect(hit).toEqual({
      containerCount: 11,
      etaLabel: "16-24 Jul",
      nextEtaPort: "2026-07-16",
    });

    const miss = resolveInboundForRecommendation(
      { supplierName: "Atlas", supplierExternalId: "FK020" },
      inbound,
      nameMap
    );
    expect(miss).toBeNull();
  });
});
