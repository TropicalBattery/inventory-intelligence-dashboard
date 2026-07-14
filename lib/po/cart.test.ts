import { describe, expect, it } from "vitest";
import { buildCartResponse } from "@/lib/po/cart";
import type { PoCartItem } from "@/lib/types";

function item(overrides: Partial<PoCartItem>): PoCartItem {
  return {
    id: "1",
    tenantId: "tropical-battery",
    createdBy: "a@b.com",
    sku: "SKU-1",
    productName: "Item",
    quantity: 2,
    supplierExternalId: null,
    unitPrice: 10,
    currency: "USD",
    sourceStatus: "critical",
    addedAt: "2026-07-13T00:00:00Z",
    updatedAt: "2026-07-13T00:00:00Z",
    ...overrides,
  };
}

describe("buildCartResponse", () => {
  it("groups by supplier, puts UNASSIGNED last, and totals items", () => {
    const names = new Map([["SUP-B", "Beta"], ["SUP-A", "Alpha"]]);
    const response = buildCartResponse(
      [
        item({ id: "1", sku: "Z", supplierExternalId: null, unitPrice: 5 }),
        item({
          id: "2",
          sku: "A",
          supplierExternalId: "SUP-B",
          unitPrice: 3,
          quantity: 2,
        }),
        item({
          id: "3",
          sku: "B",
          supplierExternalId: "SUP-A",
          unitPrice: 4,
          quantity: 1,
        }),
      ],
      names
    );

    expect(response.totalItems).toBe(3);
    expect(response.groups.map((g) => g.supplierName)).toEqual([
      "Alpha",
      "Beta",
      null,
    ]);
    expect(response.groups[0]?.subtotalUsd).toBe(4);
    expect(response.groups[1]?.subtotalUsd).toBe(6);
    expect(response.groups[2]?.supplierExternalId).toBeNull();
  });
});
