import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { TENANT_ID } from "@/lib/tenant";

type SupplierNameRow = {
  external_id: string;
  name: string | null;
};

type ReferenceSupplierRow = {
  supplier_external_id: string | null;
};

type VendorLockRow = {
  locked_vendor_id: string | null;
};

/**
 * Full tenant map: suppliers.external_id → trimmed name.
 * Request-scoped via React cache (one fetch shared across call sites).
 */
export const getSupplierNameMap = cache(
  async (): Promise<Map<string, string>> => {
    const supabase = createAdminClient();
    const map = new Map<string, string>();

    try {
      const rows = await fetchAllPages<SupplierNameRow>(async (from, to) => {
        const { data, error } = await supabase
          .from("suppliers")
          .select("external_id, name")
          .eq("tenant_id", TENANT_ID)
          .range(from, to);

        return {
          data: data as SupplierNameRow[] | null,
          error,
        };
      });

      for (const row of rows) {
        if (!row.external_id) {
          continue;
        }
        const name = row.name?.trim();
        if (name) {
          map.set(row.external_id, name);
        }
      }
    } catch (error) {
      console.error(
        "Failed to fetch supplier name map:",
        error instanceof Error ? error.message : error
      );
    }

    return map;
  }
);

export type SupplierFilterOption = {
  externalId: string;
  /** Trimmed display name when known. */
  name: string | null;
};

/**
 * Suppliers for Reorder filter dropdown: union of item_supplier_reference
 * vendors and purchase-rule vendor locks, with names from getSupplierNameMap.
 * Sorted alphabetically by name (code fallback).
 */
export const getSupplierFilterOptions = cache(
  async (): Promise<SupplierFilterOption[]> => {
    const supabase = createAdminClient();
    const ids = new Set<string>();

    try {
      const [referenceRows, lockRows, nameMap] = await Promise.all([
        fetchAllPages<ReferenceSupplierRow>(async (from, to) => {
          const { data, error } = await supabase
            .from("item_supplier_reference")
            .select("supplier_external_id")
            .eq("tenant_id", TENANT_ID)
            .not("supplier_external_id", "is", null)
            .range(from, to);

          return {
            data: data as ReferenceSupplierRow[] | null,
            error,
          };
        }),
        fetchAllPages<VendorLockRow>(async (from, to) => {
          const { data, error } = await supabase
            .from("item_purchase_rules")
            .select("locked_vendor_id")
            .eq("tenant_id", TENANT_ID)
            .eq("rule_type", "vendor_lock")
            .not("locked_vendor_id", "is", null)
            .range(from, to);

          return {
            data: data as VendorLockRow[] | null,
            error,
          };
        }),
        getSupplierNameMap(),
      ]);

      for (const row of referenceRows) {
        if (row.supplier_external_id) {
          ids.add(row.supplier_external_id);
        }
      }
      for (const row of lockRows) {
        if (row.locked_vendor_id) {
          ids.add(row.locked_vendor_id);
        }
      }

      return Array.from(ids)
        .map((externalId) => ({
          externalId,
          name: nameMap.get(externalId) ?? null,
        }))
        .sort((left, right) => {
          const leftLabel = (left.name ?? left.externalId).toLocaleLowerCase();
          const rightLabel = (right.name ?? right.externalId).toLocaleLowerCase();
          return leftLabel.localeCompare(rightLabel);
        });
    } catch (error) {
      console.error(
        "Failed to fetch supplier filter options:",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }
);

/** Label for filter/option lists: "Atlas (FK020)" or code alone. */
export function formatSupplierOptionLabel(
  name: string | null | undefined,
  externalId: string
): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return `${trimmed} (${externalId})`;
  }
  return externalId;
}

/**
 * Primary UI label: name when known, otherwise raw code.
 * Put the code in a title tooltip separately when showing the name.
 */
export function resolveSupplierDisplayName(
  name: string | null | undefined,
  externalId: string | null | undefined
): string {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName;
  }
  const code = externalId?.trim();
  return code || "-";
}
