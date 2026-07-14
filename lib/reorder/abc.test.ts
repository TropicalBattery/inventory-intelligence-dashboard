import { describe, expect, it } from "vitest";
import { assignAbcClasses } from "@/lib/reorder/abc";

describe("assignAbcClasses", () => {
  it("splits a known value distribution at the 80% / 95% cumulative boundaries", () => {
    // Values: 40+20+10+5+5+4+4+4+4+4 = 100
    // After A5, cumulative = 80%. Next SKUs start with shareBefore >= 0.8 (B)
    // until shareBefore >= 0.95 (C).
    const inputs = [
      { sku: "A1", annualDemandUnits: 40, unitCost: 1 },
      { sku: "A2", annualDemandUnits: 20, unitCost: 1 },
      { sku: "A3", annualDemandUnits: 10, unitCost: 1 },
      { sku: "A4", annualDemandUnits: 5, unitCost: 1 },
      { sku: "A5", annualDemandUnits: 5, unitCost: 1 },
      { sku: "B1", annualDemandUnits: 4, unitCost: 1 },
      { sku: "B2", annualDemandUnits: 4, unitCost: 1 },
      { sku: "B3", annualDemandUnits: 4, unitCost: 1 },
      { sku: "B4", annualDemandUnits: 4, unitCost: 1 },
      { sku: "C1", annualDemandUnits: 4, unitCost: 1 },
    ];

    const map = assignAbcClasses(inputs);

    expect(map.get("A1")).toBe("A");
    expect(map.get("A2")).toBe("A");
    expect(map.get("A3")).toBe("A");
    expect(map.get("A4")).toBe("A");
    expect(map.get("A5")).toBe("A");
    expect(map.get("B1")).toBe("B");
    expect(map.get("B2")).toBe("B");
    expect(map.get("B3")).toBe("B");
    expect(map.get("B4")).toBe("B");
    expect(map.get("C1")).toBe("C");
  });

  it("assigns null when cost or demand is missing or zero", () => {
    const map = assignAbcClasses([
      { sku: "OK", annualDemandUnits: 100, unitCost: 10 },
      { sku: "NO_COST", annualDemandUnits: 100, unitCost: null },
      { sku: "NO_DEMAND", annualDemandUnits: null, unitCost: 10 },
      { sku: "ZERO_COST", annualDemandUnits: 50, unitCost: 0 },
      { sku: "ZERO_DEMAND", annualDemandUnits: 0, unitCost: 20 },
    ]);

    expect(map.get("OK")).toBe("A");
    expect(map.get("NO_COST")).toBeNull();
    expect(map.get("NO_DEMAND")).toBeNull();
    expect(map.get("ZERO_COST")).toBeNull();
    expect(map.get("ZERO_DEMAND")).toBeNull();
  });
});
