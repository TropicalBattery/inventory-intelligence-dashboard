import { describe, expect, it } from "vitest";
import {
  COVER_CRITICAL_MONTHS,
  COVER_OK_MONTHS,
  COVER_WATCH_MONTHS,
  DAYS_PER_MONTH,
  DIRTY_REORDER_LEVEL_SENTINEL,
  LEADTIME_CRITICAL_MULTIPLE,
  LEADTIME_OK_MULTIPLE,
  LEADTIME_WATCH_MULTIPLE,
  resolveCoverBands,
  resolveEffectiveLeadTime,
  sanitizeReorderLevel,
} from "@/lib/reorder/cover-thresholds";
import { classifyReorderStatus } from "@/lib/reorder-engine";

describe("sanitizeReorderLevel", () => {
  it("returns null for null and undefined", () => {
    expect(sanitizeReorderLevel(null)).toBeNull();
    expect(sanitizeReorderLevel(undefined)).toBeNull();
  });

  it("returns null for zero and negative values (GP unset)", () => {
    expect(sanitizeReorderLevel(0)).toBeNull();
    expect(sanitizeReorderLevel(-1)).toBeNull();
  });

  it("returns null for the dirty 5274 sentinel", () => {
    expect(sanitizeReorderLevel(DIRTY_REORDER_LEVEL_SENTINEL)).toBeNull();
  });

  it("preserves sane positive reorder levels", () => {
    expect(sanitizeReorderLevel(50)).toBe(50);
    expect(sanitizeReorderLevel(999)).toBe(999);
  });
});

describe("resolveCoverBands", () => {
  it("falls back to global bands when lead time is missing", () => {
    expect(resolveCoverBands(null)).toEqual({
      criticalBelow: COVER_CRITICAL_MONTHS,
      watchBelow: COVER_WATCH_MONTHS,
      okBelow: COVER_OK_MONTHS,
    });
    expect(resolveCoverBands(0)).toEqual({
      criticalBelow: COVER_CRITICAL_MONTHS,
      watchBelow: COVER_WATCH_MONTHS,
      okBelow: COVER_OK_MONTHS,
    });
  });

  it("scales bands from lead time with OK floor", () => {
    const korea = resolveCoverBands(93);
    expect(korea.criticalBelow).toBeCloseTo(
      (93 / DAYS_PER_MONTH) * LEADTIME_CRITICAL_MULTIPLE,
      5
    );
    expect(korea.watchBelow).toBeCloseTo(
      (93 / DAYS_PER_MONTH) * LEADTIME_WATCH_MULTIPLE,
      5
    );
    expect(korea.okBelow).toBe(
      Math.max((93 / DAYS_PER_MONTH) * LEADTIME_OK_MULTIPLE, COVER_OK_MONTHS)
    );

    const us = resolveCoverBands(47);
    expect(us.criticalBelow).toBeCloseTo(
      (47 / DAYS_PER_MONTH) * LEADTIME_CRITICAL_MULTIPLE,
      5
    );
    expect(us.watchBelow).toBeCloseTo(
      (47 / DAYS_PER_MONTH) * LEADTIME_WATCH_MULTIPLE,
      5
    );
    expect(us.okBelow).toBe(COVER_OK_MONTHS);
  });
});

describe("resolveEffectiveLeadTime", () => {
  const rows = [
    {
      supplier_external_id: "PRIORITY",
      lead_time_days: 47,
      is_priority_vendor: true,
    },
    {
      supplier_external_id: "LOCKED",
      lead_time_days: 93,
      is_priority_vendor: false,
    },
    {
      supplier_external_id: "FAST",
      lead_time_days: 14,
      is_priority_vendor: false,
    },
  ];

  it("prefers locked vendor over priority vendor", () => {
    const resolved = resolveEffectiveLeadTime(rows, "LOCKED");
    expect(resolved).toEqual({
      days: 93,
      source: "locked_vendor",
      supplierExternalId: "LOCKED",
    });
  });

  it("uses priority vendor when no lock", () => {
    const resolved = resolveEffectiveLeadTime(rows, null);
    expect(resolved).toEqual({
      days: 47,
      source: "priority_vendor",
      supplierExternalId: "PRIORITY",
    });
  });

  it("falls back to minimum lead across refs", () => {
    const noPriority = rows.map((row) => ({
      ...row,
      is_priority_vendor: false,
    }));
    const resolved = resolveEffectiveLeadTime(noPriority, null);
    expect(resolved).toEqual({
      days: 14,
      source: "any_vendor",
      supplierExternalId: "FAST",
    });
  });
});

describe("classifyReorderStatus with lead-time bands", () => {
  const base = {
    quantityOnOrder: 0,
    quantityInPipeline: 0,
    rop: null,
    reorderLevel: null,
    suggestedQty: 0,
    annualDemandUnits: 1200, // 100 units / month
    quantityOnHand: 250,
    unitCost: 100,
    quantityAvailable: 250,
    quantityAllocated: 0,
  };

  it("treats 2.5 months cover as critical for a 93-day lead", () => {
    // criticalBelow ≈ 3.05
    expect(
      classifyReorderStatus({
        ...base,
        coverBands: resolveCoverBands(93),
      })
    ).toBe("critical");
  });

  it("treats 2.5 months cover as reorder_needed for a 47-day lead", () => {
    // critical≈1.54, watch≈2.32, ok floor 6 → 2.5 is reorder_needed
    expect(
      classifyReorderStatus({
        ...base,
        coverBands: resolveCoverBands(47),
      })
    ).toBe("reorder_needed");
  });

  it("matches prior global bands when no lead time (regression)", () => {
    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 40,
        quantityOnHand: 40,
        coverBands: resolveCoverBands(null),
      })
    ).toBe("critical");

    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 150,
        quantityOnHand: 150,
        coverBands: resolveCoverBands(null),
      })
    ).toBe("watch");

    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 300,
        quantityOnHand: 300,
        coverBands: resolveCoverBands(null),
      })
    ).toBe("reorder_needed");

    expect(
      classifyReorderStatus({
        ...base,
        quantityAvailable: 700,
        quantityOnHand: 700,
        coverBands: resolveCoverBands(null),
      })
    ).toBe("ok");
  });
});
