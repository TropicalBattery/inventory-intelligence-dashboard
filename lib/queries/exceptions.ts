import { cache } from "react";
import {
  detectExceptions,
  summarizeExceptions,
  type ExceptionSummary,
  type NegativeStockRow,
  type SkuExceptionGroup,
  type StaleDemandRow,
} from "@/lib/exceptions/detect";
import { getReorderRecommendations } from "@/lib/queries/reorder";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPages } from "@/lib/supabase/paginate";
import { toNumber } from "@/lib/format";
import { TENANT_ID } from "@/lib/tenant";

export type DataExceptionsResult = {
  groups: SkuExceptionGroup[];
  summary: ExceptionSummary;
};

type BalanceNegRow = {
  sku: string | null;
  location_code: string | null;
  quantity_on_hand: number | string | null;
  quantity_available: number | string | null;
};

type BalanceSalesRow = {
  sku: string | null;
  last_sales_date: string | null;
  quantity_on_hand: number | string | null;
};

async function fetchNegativeStockRows(): Promise<NegativeStockRow[]> {
  try {
    const rows = await fetchAllPages<BalanceNegRow>(async (from, to) => {
      const { data, error } = await createAdminClient()
        .from("inventory_balances")
        .select("sku, location_code, quantity_on_hand, quantity_available")
        .eq("tenant_id", TENANT_ID)
        .or("quantity_on_hand.lt.0,quantity_available.lt.0")
        .order("sku", { ascending: true })
        .range(from, to);

      return { data, error };
    });

    const bySku = new Map<string, NegativeStockRow>();
    for (const row of rows) {
      if (!row.sku) {
        continue;
      }
      const quantityOnHand = toNumber(row.quantity_on_hand);
      const quantityAvailable = toNumber(row.quantity_available);
      if (!(quantityOnHand < 0 || quantityAvailable < 0)) {
        continue;
      }

      const current = bySku.get(row.sku);
      const candidate: NegativeStockRow = {
        sku: row.sku,
        locationCode: row.location_code?.trim() || null,
        quantityOnHand,
        quantityAvailable,
      };

      // Keep the most negative offending quantity for display.
      if (!current) {
        bySku.set(row.sku, candidate);
        continue;
      }
      const currentWorst = Math.min(
        current.quantityOnHand,
        current.quantityAvailable
      );
      const nextWorst = Math.min(quantityOnHand, quantityAvailable);
      if (nextWorst < currentWorst) {
        bySku.set(row.sku, candidate);
      }
    }

    return Array.from(bySku.values());
  } catch (error) {
    console.error(
      "Failed to fetch negative stock balances:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

async function fetchStaleDemandRows(
  skus: string[]
): Promise<StaleDemandRow[]> {
  if (skus.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  const lastSaleBySku = new Map<string, string>();
  const chunkSize = 200;

  try {
    for (let i = 0; i < skus.length; i += chunkSize) {
      const chunk = skus.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from("inventory_balances")
        .select("sku, last_sales_date, quantity_on_hand")
        .eq("tenant_id", TENANT_ID)
        .in("sku", chunk)
        .not("last_sales_date", "is", null);

      if (error) {
        console.error("Failed to fetch last sales dates:", error.message);
        continue;
      }

      for (const row of (data ?? []) as BalanceSalesRow[]) {
        if (!row.sku || !row.last_sales_date) {
          continue;
        }
        const current = lastSaleBySku.get(row.sku);
        if (!current || row.last_sales_date > current) {
          lastSaleBySku.set(row.sku, row.last_sales_date);
        }
      }
    }
  } catch (error) {
    console.error(
      "Failed to fetch stale demand inputs:",
      error instanceof Error ? error.message : error
    );
    return [];
  }

  return skus
    .map((sku) => {
      const lastSalesDate = lastSaleBySku.get(sku);
      if (!lastSalesDate) {
        return null;
      }
      return {
        sku,
        lastSalesDate,
        quantityOnHand: 0,
      } satisfies StaleDemandRow;
    })
    .filter((row): row is StaleDemandRow => row !== null);
}

/** Cached exception catalogue for dashboard + /exceptions. */
export const getDataExceptions = cache(
  async (): Promise<DataExceptionsResult> => {
    const recommendations = await getReorderRecommendations(TENANT_ID);

    const stockHolders = recommendations.filter(
      (rec) => rec.isWhitelisted && rec.quantityOnHand > 0
    );

    const [negativeStockRows, staleRaw] = await Promise.all([
      fetchNegativeStockRows(),
      fetchStaleDemandRows(stockHolders.map((rec) => rec.sku)),
    ]);

    const onHandBySku = new Map(
      stockHolders.map((rec) => [rec.sku, rec.quantityOnHand] as const)
    );

    const staleDemandRows: StaleDemandRow[] = staleRaw.map((row) => ({
      ...row,
      quantityOnHand: onHandBySku.get(row.sku) ?? row.quantityOnHand,
    }));

    const groups = detectExceptions({
      recommendations,
      negativeStockRows,
      staleDemandRows,
    });

    // Fill names for negative-stock-only SKUs from recommendations when present.
    const nameBySku = new Map(
      recommendations.map((rec) => [rec.sku, rec.name] as const)
    );
    for (const group of groups) {
      if (!group.name) {
        group.name = nameBySku.get(group.sku) ?? null;
      }
    }

    return {
      groups,
      summary: summarizeExceptions(groups),
    };
  }
);
