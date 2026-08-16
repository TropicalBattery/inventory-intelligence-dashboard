import { toNumber } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import { cache } from "react";

export type MonthlySalesTrendPoint = {
  /** Calendar month start as YYYY-MM-DD */
  month: string;
  units: number;
};

export type InventoryTrendPoint = {
  /** Calendar month start as YYYY-MM-DD */
  month: string;
  unitsOnHand: number;
};

function startOfCurrentUtcMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function toMonthKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const d = new Date(parsed);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

/**
 * Last 12 completed calendar months of tenant-level sales units.
 * Reads vw_monthly_sales_total (current partial month excluded).
 */
export const getMonthlySalesTrend = cache(
  async (
    tenantId: string = TENANT_ID
  ): Promise<MonthlySalesTrendPoint[]> => {
    const started = performance.now();
    const supabase = createAdminClient();
    const windowEnd = startOfCurrentUtcMonthIso();

    const { data, error } = await supabase
      .from("vw_monthly_sales_total")
      .select("sales_month, units")
      .eq("tenant_id", tenantId)
      .lt("sales_month", windowEnd)
      .order("sales_month", { ascending: false })
      .limit(12);

    const elapsed = Math.round(performance.now() - started);
    console.info(`[PERF] getMonthlySalesTrend ${elapsed}ms`);

    if (error) {
      console.warn("Failed to fetch monthly sales trend:", error.message);
      return [];
    }

    const points: MonthlySalesTrendPoint[] = [];
    for (const row of data ?? []) {
      const month = toMonthKey(
        (row as { sales_month?: string | null }).sales_month
      );
      if (!month) {
        continue;
      }
      points.push({
        month,
        units: toNumber((row as { units?: number | string | null }).units),
      });
    }

    return points.reverse();
  }
);

/**
 * Last 12 inventory snapshot months (sparse early on).
 */
export const getInventoryTrend = cache(
  async (tenantId: string = TENANT_ID): Promise<InventoryTrendPoint[]> => {
    const started = performance.now();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("inventory_snapshots")
      .select("snapshot_month, total_units_on_hand")
      .eq("tenant_id", tenantId)
      .order("snapshot_month", { ascending: false })
      .limit(12);

    const elapsed = Math.round(performance.now() - started);
    console.info(`[PERF] getInventoryTrend ${elapsed}ms`);

    if (error) {
      console.warn("Failed to fetch inventory trend:", error.message);
      return [];
    }

    const points: InventoryTrendPoint[] = [];
    for (const row of data ?? []) {
      const month = toMonthKey(
        (row as { snapshot_month?: string | null }).snapshot_month
      );
      if (!month) {
        continue;
      }
      points.push({
        month,
        unitsOnHand: toNumber(
          (row as { total_units_on_hand?: number | string | null })
            .total_units_on_hand
        ),
      });
    }

    return points.reverse();
  }
);
