import {
  buildCartResponse,
  fetchUserCartItems,
  lookupSupplierNames,
  mapCartRow,
} from "@/lib/po/cart";
import { getItemPurchaseRulesBySku } from "@/lib/queries/item-purchase-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import type {
  ItemPurchaseRule,
  PoCartItem,
  ReorderStatus,
} from "@/lib/types";

export type PoReviewSkuSupplierOption = {
  supplierExternalId: string;
  supplierName: string | null;
  unitPrice: number | null;
  leadTimeDays: number | null;
  isPriorityVendor: boolean;
  palletQty: number | null;
};

export type PoReviewActiveSupplier = {
  externalId: string;
  name: string | null;
  supplierCode: string | null;
};

export type PoReviewGroup = {
  supplierExternalId: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  supplierAddress: string | null;
  supplierCode: string | null;
  items: PoCartItem[];
  subtotalUsd: number | null;
};

export type PoCartFullReviewData = {
  groups: PoReviewGroup[];
  totalItems: number;
  skuSupplierOptions: Record<string, PoReviewSkuSupplierOption[]>;
  activeSuppliers: PoReviewActiveSupplier[];
  purchaseRulesBySku: Record<string, ItemPurchaseRule>;
};

type SupplierDbRow = {
  external_id: string;
  name: string | null;
  email: string | null;
  address: string | null;
  supplier_code: string | null;
};

type ReferenceDbRow = {
  sku: string;
  supplier_external_id: string;
  unit_price: number | string | null;
  lead_time_days: number | string | null;
  is_priority_vendor: boolean | null;
  pallet_qty: number | string | null;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function sortSkuSupplierOptions(
  options: PoReviewSkuSupplierOption[]
): PoReviewSkuSupplierOption[] {
  return [...options].sort((left, right) => {
    if (left.isPriorityVendor !== right.isPriorityVendor) {
      return left.isPriorityVendor ? -1 : 1;
    }
    const leadLeft = left.leadTimeDays ?? Number.POSITIVE_INFINITY;
    const leadRight = right.leadTimeDays ?? Number.POSITIVE_INFINITY;
    if (leadLeft !== leadRight) {
      return leadLeft - leadRight;
    }
    const priceLeft = left.unitPrice ?? Number.POSITIVE_INFINITY;
    const priceRight = right.unitPrice ?? Number.POSITIVE_INFINITY;
    return priceLeft - priceRight;
  });
}

async function loadSkuOptionsAndSuppliers(skus: string[]): Promise<{
  skuSupplierOptions: Record<string, PoReviewSkuSupplierOption[]>;
  activeSuppliers: PoReviewActiveSupplier[];
  supplierById: Map<string, SupplierDbRow>;
}> {
  const supabase = createAdminClient();

  const [referencesResult, activeSuppliersResult] = await Promise.all([
    skus.length > 0
      ? supabase
          .from("item_supplier_reference")
          .select(
            "sku, supplier_external_id, unit_price, lead_time_days, is_priority_vendor, pallet_qty"
          )
          .eq("tenant_id", TENANT_ID)
          .in("sku", skus)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("suppliers")
      .select("external_id, name, email, address, supplier_code")
      .eq("tenant_id", TENANT_ID)
      .order("name", { ascending: true }),
  ]);

  const references = (referencesResult.data ?? []) as ReferenceDbRow[];
  const activeSupplierRows = (activeSuppliersResult.data ??
    []) as SupplierDbRow[];

  const supplierById = new Map<string, SupplierDbRow>();
  const nameByExternalId = new Map<string, string | null>();
  for (const row of activeSupplierRows) {
    supplierById.set(row.external_id, row);
    nameByExternalId.set(row.external_id, row.name);
  }

  const optionsBySku = new Map<string, PoReviewSkuSupplierOption[]>();
  for (const row of references) {
    const option: PoReviewSkuSupplierOption = {
      supplierExternalId: row.supplier_external_id,
      supplierName: nameByExternalId.get(row.supplier_external_id) ?? null,
      unitPrice: toNumber(row.unit_price),
      leadTimeDays: toNumber(row.lead_time_days),
      isPriorityVendor: row.is_priority_vendor ?? false,
      palletQty: toNumber(row.pallet_qty),
    };
    const list = optionsBySku.get(row.sku) ?? [];
    list.push(option);
    optionsBySku.set(row.sku, list);
  }

  const skuSupplierOptions: Record<string, PoReviewSkuSupplierOption[]> = {};
  for (const [sku, list] of Array.from(optionsBySku.entries())) {
    skuSupplierOptions[sku] = sortSkuSupplierOptions(list);
  }

  return {
    skuSupplierOptions,
    activeSuppliers: activeSupplierRows.map((row) => ({
      externalId: row.external_id,
      name: row.name,
      supplierCode: row.supplier_code,
    })),
    supplierById,
  };
}

export async function getFullPoCartReviewData(
  createdBy: string
): Promise<PoCartFullReviewData> {
  const cartRows = await fetchUserCartItems(createdBy);
  const items = cartRows.map(mapCartRow);
  const skus = Array.from(new Set(items.map((item) => item.sku)));

  const { skuSupplierOptions, activeSuppliers, supplierById } =
    await loadSkuOptionsAndSuppliers(skus);

  const purchaseRules = await getItemPurchaseRulesBySku();
  const purchaseRulesBySku: Record<string, ItemPurchaseRule> = {};
  for (const sku of skus) {
    const rule = purchaseRules.get(sku);
    if (rule) {
      purchaseRulesBySku[sku] = rule;
    }
  }

  const supplierIds = Array.from(
    new Set(
      items
        .map((item) => item.supplierExternalId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const supplierNames = await lookupSupplierNames(supplierIds);
  const cartResponse = buildCartResponse(items, supplierNames);

  // Unassigned first, then named (buildCartResponse already puts UNASSIGNED last —
  // reverse that for the review page).
  const orderedGroups = [...cartResponse.groups].sort((left, right) => {
    if (left.supplierExternalId === null && right.supplierExternalId !== null) {
      return -1;
    }
    if (right.supplierExternalId === null && left.supplierExternalId !== null) {
      return 1;
    }
    const leftName = left.supplierName ?? left.supplierExternalId ?? "";
    const rightName = right.supplierName ?? right.supplierExternalId ?? "";
    return leftName.localeCompare(rightName);
  });

  const groups: PoReviewGroup[] = orderedGroups.map((group) => {
    const supplier = group.supplierExternalId
      ? supplierById.get(group.supplierExternalId)
      : null;
    return {
      supplierExternalId: group.supplierExternalId,
      supplierName:
        group.supplierName ?? supplier?.name ?? group.supplierExternalId,
      supplierEmail: supplier?.email ?? null,
      supplierAddress: supplier?.address ?? null,
      supplierCode: supplier?.supplier_code ?? null,
      items: group.items,
      subtotalUsd: group.subtotalUsd,
    };
  });

  return {
    groups,
    totalItems: cartResponse.totalItems,
    skuSupplierOptions,
    activeSuppliers,
    purchaseRulesBySku,
  };
}

export function isReorderStatus(value: string | null): value is ReorderStatus {
  return (
    value === "critical" ||
    value === "watch" ||
    value === "reorder_needed" ||
    value === "ok" ||
    value === "no_demand"
  );
}
