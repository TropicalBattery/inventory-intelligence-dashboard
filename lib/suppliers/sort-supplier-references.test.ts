import { describe, expect, it } from "vitest";
import { sortSupplierReferencesForComparison } from "@/lib/suppliers/sort-supplier-references";
import type { SupplierReference } from "@/lib/types";

function supplier(
  overrides: Partial<SupplierReference> & Pick<SupplierReference, "supplierExternalId">
): SupplierReference {
  return {
    supplierName: null,
    unitPrice: null,
    leadTimeDays: null,
    isPriorityVendor: false,
    vendorItemNumber: null,
    currency: "JMD",
    reliabilityRating: null,
    supplierRegion: null,
    minOrderQty: null,
    notes: null,
    ...overrides,
  };
}

describe("sortSupplierReferencesForComparison", () => {
  it("sorts quoted suppliers before missing quotes", () => {
    const sorted = sortSupplierReferencesForComparison([
      supplier({
        supplierExternalId: "no-quote",
        hasQuoteOnFile: false,
        unitPrice: 1,
      }),
      supplier({
        supplierExternalId: "quoted",
        hasQuoteOnFile: true,
        unitPrice: 999,
      }),
    ]);

    expect(sorted.map((row) => row.supplierExternalId)).toEqual([
      "quoted",
      "no-quote",
    ]);
  });

  it("sorts by reliability, then lead time, then price", () => {
    const sorted = sortSupplierReferencesForComparison([
      supplier({
        supplierExternalId: "cheap-conditional",
        reliabilityRating: "Conditional",
        leadTimeDays: 30,
        unitPrice: 10,
      }),
      supplier({
        supplierExternalId: "preferred-slow",
        reliabilityRating: "Preferred",
        leadTimeDays: 90,
        unitPrice: 100,
      }),
      supplier({
        supplierExternalId: "approved-fast",
        reliabilityRating: "Approved",
        leadTimeDays: 14,
        unitPrice: 50,
      }),
      supplier({
        supplierExternalId: "preferred-fast",
        reliabilityRating: "Preferred",
        leadTimeDays: 7,
        unitPrice: 80,
      }),
    ]);

    expect(sorted.map((row) => row.supplierExternalId)).toEqual([
      "preferred-fast",
      "preferred-slow",
      "approved-fast",
      "cheap-conditional",
    ]);
  });
});
