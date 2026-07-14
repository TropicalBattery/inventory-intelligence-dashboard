import type { ItemPurchaseRule } from "@/lib/types";

const DO_NOT_BUY_BADGE_CLASS =
  "inline-flex whitespace-nowrap rounded-full border border-[#FCA5A5] bg-[#FDF2F2] px-2 py-0.5 text-[10px] font-semibold text-[#CC2B2B]";

export function isPurchaseBlockedRule(
  rule: ItemPurchaseRule | null | undefined
): rule is ItemPurchaseRule & {
  ruleType: "discontinue" | "do_not_buy";
} {
  return rule?.ruleType === "discontinue" || rule?.ruleType === "do_not_buy";
}

export function getDoNotBuyBadgeMeta(
  rule: ItemPurchaseRule | null | undefined
): { label: string; title: string; className: string } | null {
  if (!isPurchaseBlockedRule(rule)) {
    return null;
  }

  return {
    label: "No buy",
    title:
      rule.ruleType === "discontinue"
        ? "Discontinued per buyer rules"
        : "Do not buy per buyer rules",
    className: DO_NOT_BUY_BADGE_CLASS,
  };
}

export function getPurchaseBlockNote(
  rule: ItemPurchaseRule | null | undefined
): string | null {
  if (!isPurchaseBlockedRule(rule)) {
    return null;
  }

  const reason =
    rule.ruleType === "discontinue" ? "discontinued" : "do not buy";
  return `Purchasing blocked: ${reason} per buyer rules`;
}

export function resolveCartSupplierForRule(
  rule: ItemPurchaseRule | null | undefined,
  selectedSupplierExternalId: string | null | undefined
): string | null {
  if (rule?.ruleType === "vendor_lock" && rule.lockedVendorId) {
    return rule.lockedVendorId;
  }
  return selectedSupplierExternalId ?? null;
}
