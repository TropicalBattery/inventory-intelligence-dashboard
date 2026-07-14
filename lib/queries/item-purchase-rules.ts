import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { TENANT_ID } from "@/lib/tenant";
import type { ItemPurchaseRule, ItemPurchaseRuleType } from "@/lib/types";

type PurchaseRuleRow = {
  sku: string | null;
  rule_type: string | null;
  locked_vendor_id: string | null;
};

const RULE_TYPES = new Set<ItemPurchaseRuleType>([
  "discontinue",
  "do_not_buy",
  "vendor_lock",
]);

function parseRuleType(value: string | null): ItemPurchaseRuleType | null {
  if (!value || !RULE_TYPES.has(value as ItemPurchaseRuleType)) {
    return null;
  }
  return value as ItemPurchaseRuleType;
}

function mapRow(row: PurchaseRuleRow): ItemPurchaseRule | null {
  if (!row.sku) {
    return null;
  }
  const ruleType = parseRuleType(row.rule_type);
  if (!ruleType) {
    return null;
  }
  return {
    ruleType,
    lockedVendorId: row.locked_vendor_id?.trim() || null,
  };
}

async function loadItemPurchaseRulesBySku(): Promise<
  Map<string, ItemPurchaseRule>
> {
  try {
    const rows = await fetchAllPages<PurchaseRuleRow>(async (from, to) => {
      const { data, error } = await createAdminClient()
        .from("item_purchase_rules")
        .select("sku, rule_type, locked_vendor_id")
        .eq("tenant_id", TENANT_ID)
        .order("sku", { ascending: true })
        .range(from, to);

      return { data, error };
    });

    const bySku = new Map<string, ItemPurchaseRule>();
    for (const row of rows) {
      const mapped = mapRow(row);
      if (!mapped || !row.sku) {
        continue;
      }
      // Last-write wins if duplicates; unlikely with one rule per SKU.
      bySku.set(row.sku, mapped);
    }
    return bySku;
  } catch (error) {
    console.error(
      "Failed to fetch item purchase rules:",
      error instanceof Error ? error.message : error
    );
    return new Map();
  }
}

/** Request-scoped purchase rules keyed by SKU. */
export const getItemPurchaseRulesBySku = cache(
  async (): Promise<Map<string, ItemPurchaseRule>> => loadItemPurchaseRulesBySku()
);

export async function getItemPurchaseRuleForSku(
  sku: string
): Promise<ItemPurchaseRule | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("item_purchase_rules")
    .select("sku, rule_type, locked_vendor_id")
    .eq("tenant_id", TENANT_ID)
    .eq("sku", sku)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch purchase rule for SKU:", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return mapRow(data as PurchaseRuleRow);
}

export function isPurchaseBlocked(
  rule: ItemPurchaseRule | null | undefined
): rule is ItemPurchaseRule & {
  ruleType: "discontinue" | "do_not_buy";
} {
  return rule?.ruleType === "discontinue" || rule?.ruleType === "do_not_buy";
}

export function purchaseBlockLabel(
  ruleType: "discontinue" | "do_not_buy"
): string {
  return ruleType === "discontinue" ? "discontinued" : "do not buy";
}

export function purchaseBlockErrorMessage(
  sku: string,
  ruleType: "discontinue" | "do_not_buy"
): string {
  return `SKU ${sku} is marked ${purchaseBlockLabel(ruleType)} and cannot be ordered`;
}
