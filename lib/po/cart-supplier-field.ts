import type { PoReviewSkuSupplierOption } from "@/lib/queries/po-cart-review";
import type { ItemPurchaseRule, PoCartItem } from "@/lib/types";
import type { UserRole } from "@/lib/auth/role-guards";

/** Priority vendor first, then price ascending (nulls last). */
export function sortPickerOptions(
  options: PoReviewSkuSupplierOption[]
): PoReviewSkuSupplierOption[] {
  return [...options].sort((left, right) => {
    if (left.isPriorityVendor !== right.isPriorityVendor) {
      return left.isPriorityVendor ? -1 : 1;
    }
    const priceLeft = left.unitPrice ?? Number.POSITIVE_INFINITY;
    const priceRight = right.unitPrice ?? Number.POSITIVE_INFINITY;
    if (priceLeft !== priceRight) {
      return priceLeft - priceRight;
    }
    return left.supplierExternalId.localeCompare(right.supplierExternalId);
  });
}

export function cheapestQuotedOption(
  options: PoReviewSkuSupplierOption[]
): PoReviewSkuSupplierOption | null {
  let best: PoReviewSkuSupplierOption | null = null;
  for (const opt of options) {
    if (opt.unitPrice === null || !Number.isFinite(opt.unitPrice)) {
      continue;
    }
    if (!best || (best.unitPrice ?? Infinity) > opt.unitPrice) {
      best = opt;
    }
  }
  return best;
}

export type CartSupplierLineState =
  | "unlocked_picker"
  | "plain_lock"
  | "locked_buyer_view"
  | "locked_approver_override"
  | "overridden"
  | "static";

export function resolveCartSupplierLineState(params: {
  item: PoCartItem;
  options: PoReviewSkuSupplierOption[];
  purchaseRule: ItemPurchaseRule | null | undefined;
  userRole: UserRole;
}): {
  state: CartSupplierLineState;
  isLocked: boolean;
  lockedVendorId: string | null;
  altCount: number;
  isApprover: boolean;
  isOverridden: boolean;
  sortedOptions: PoReviewSkuSupplierOption[];
  cheapestAlt: PoReviewSkuSupplierOption | null;
} {
  const { item, options, purchaseRule, userRole } = params;
  const sortedOptions = sortPickerOptions(options);
  const isApprover = userRole === "approver";
  const lockedVendorId =
    purchaseRule?.ruleType === "vendor_lock" && purchaseRule.lockedVendorId
      ? purchaseRule.lockedVendorId
      : null;
  const isLocked = Boolean(lockedVendorId);
  const isOverridden = Boolean(item.lockOverriddenBy?.trim());

  const altCount = lockedVendorId
    ? sortedOptions.filter((opt) => opt.supplierExternalId !== lockedVendorId)
        .length
    : 0;

  const cheapestAlt =
    lockedVendorId != null
      ? cheapestQuotedOption(
          sortedOptions.filter(
            (opt) => opt.supplierExternalId !== lockedVendorId
          )
        )
      : null;

  if (isOverridden && isLocked) {
    return {
      state: "overridden",
      isLocked,
      lockedVendorId,
      altCount,
      isApprover,
      isOverridden,
      sortedOptions,
      cheapestAlt,
    };
  }

  if (isLocked && lockedVendorId) {
    if (altCount === 0) {
      return {
        state: "plain_lock",
        isLocked,
        lockedVendorId,
        altCount,
        isApprover,
        isOverridden,
        sortedOptions,
        cheapestAlt,
      };
    }
    return {
      state: isApprover ? "locked_approver_override" : "locked_buyer_view",
      isLocked,
      lockedVendorId,
      altCount,
      isApprover,
      isOverridden,
      sortedOptions,
      cheapestAlt,
    };
  }

  if (sortedOptions.length >= 1) {
    return {
      state: "unlocked_picker",
      isLocked,
      lockedVendorId,
      altCount,
      isApprover,
      isOverridden,
      sortedOptions,
      cheapestAlt,
    };
  }

  return {
    state: "static",
    isLocked,
    lockedVendorId,
    altCount,
    isApprover,
    isOverridden,
    sortedOptions,
    cheapestAlt,
  };
}
