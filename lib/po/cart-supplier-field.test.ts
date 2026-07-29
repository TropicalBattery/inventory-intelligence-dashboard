import { describe, expect, it } from "vitest";
import { resolveCartSupplierLineState } from "@/lib/po/cart-supplier-field";
import type { PoReviewSkuSupplierOption } from "@/lib/queries/po-cart-review";
import type { PoCartItem } from "@/lib/types";

function item(overrides: Partial<PoCartItem> = {}): PoCartItem {
  return {
    id: "1",
    tenantId: "tropical-battery",
    createdBy: "a@b.com",
    sku: "SKU-1",
    productName: "Item",
    unitOfMeasure: null,
    quantity: 2,
    supplierExternalId: "FP070",
    unitPrice: 10,
    currency: "USD",
    sourceStatus: "critical",
    addedAt: "2026-07-13T00:00:00Z",
    updatedAt: "2026-07-13T00:00:00Z",
    lockOverrideReason: null,
    lockOverriddenBy: null,
    lockOverriddenAt: null,
    lockOriginalVendor: null,
    ...overrides,
  };
}

function opt(
  id: string,
  price: number | null,
  priority = false
): PoReviewSkuSupplierOption {
  return {
    supplierExternalId: id,
    supplierName: id,
    unitPrice: price,
    leadTimeDays: 90,
    isPriorityVendor: priority,
    palletQty: null,
  };
}

describe("resolveCartSupplierLineState", () => {
  it("unlocked multi-supplier → unlocked_picker", () => {
    const resolved = resolveCartSupplierLineState({
      item: item({ supplierExternalId: "FK020" }),
      options: [opt("FK020", 46, true), opt("FY060", 47), opt("FM030", 62)],
      purchaseRule: null,
      userRole: "buyer",
    });
    expect(resolved.state).toBe("unlocked_picker");
    expect(resolved.sortedOptions[0]?.supplierExternalId).toBe("FK020");
  });

  it("locked single-supplier → plain_lock", () => {
    const resolved = resolveCartSupplierLineState({
      item: item({ sku: "96-49-60-AGM" }),
      options: [opt("FP070", 225)],
      purchaseRule: { ruleType: "vendor_lock", lockedVendorId: "FP070" },
      userRole: "approver",
    });
    expect(resolved.state).toBe("plain_lock");
    expect(resolved.altCount).toBe(0);
  });

  it("locked multi buyer → locked_buyer_view", () => {
    const resolved = resolveCartSupplierLineState({
      item: item(),
      options: [opt("FP070", 100), opt("FA010", 80)],
      purchaseRule: { ruleType: "vendor_lock", lockedVendorId: "FP070" },
      userRole: "buyer",
    });
    expect(resolved.state).toBe("locked_buyer_view");
    expect(resolved.altCount).toBe(1);
    expect(resolved.cheapestAlt?.supplierExternalId).toBe("FA010");
  });

  it("locked multi approver → locked_approver_override", () => {
    const resolved = resolveCartSupplierLineState({
      item: item(),
      options: [opt("FB120", 50), opt("FY060", 40), opt("FM030", 60)],
      purchaseRule: { ruleType: "vendor_lock", lockedVendorId: "FB120" },
      userRole: "approver",
    });
    expect(resolved.state).toBe("locked_approver_override");
  });

  it("overridden line → overridden", () => {
    const resolved = resolveCartSupplierLineState({
      item: item({
        supplierExternalId: "FY060",
        lockOverriddenBy: "approver@x.com",
        lockOverrideReason: "price",
        lockOriginalVendor: "FB120",
      }),
      options: [opt("FB120", 50), opt("FY060", 40)],
      purchaseRule: { ruleType: "vendor_lock", lockedVendorId: "FB120" },
      userRole: "approver",
    });
    expect(resolved.state).toBe("overridden");
  });
});
