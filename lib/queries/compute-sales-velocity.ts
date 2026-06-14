import type { VwSalesVelocityRow } from "@/lib/types";

type SalesTransactionRow = {
  sku: string | null;
  quantity_sold: number | null;
  transaction_date: string | null;
};

type ProductRow = {
  tenant_id: string;
  sku: string | null;
};

function toNumber(value: number | null | undefined): number {
  return value ?? 0;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate()
  );
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
}

function aggregateSalesForSku(
  transactions: SalesTransactionRow[],
  referenceDate: Date = new Date()
): Omit<
  VwSalesVelocityRow,
  "tenant_id" | "sku"
> {
  const now = referenceDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  let unitsSoldLast30d = 0;
  let unitsSold31To60d = 0;
  let unitsSold61To90d = 0;
  let unitsSoldTrailing12m = 0;
  let lastSaleDate: string | null = null;

  for (const row of transactions) {
    if (!row.transaction_date) {
      continue;
    }

    const transactionDate = new Date(row.transaction_date);
    const ageMs = now - transactionDate.getTime();
    const quantity = toNumber(row.quantity_sold);

    if (ageMs < 0) {
      continue;
    }

    if (ageMs <= 30 * dayMs) {
      unitsSoldLast30d += quantity;
    }

    if (ageMs > 30 * dayMs && ageMs <= 60 * dayMs) {
      unitsSold31To60d += quantity;
    }

    if (ageMs > 60 * dayMs && ageMs <= 90 * dayMs) {
      unitsSold61To90d += quantity;
    }

    if (ageMs <= 365 * dayMs) {
      unitsSoldTrailing12m += quantity;
    }

    if (!lastSaleDate || transactionDate > new Date(lastSaleDate)) {
      lastSaleDate = row.transaction_date;
    }
  }

  const avgMonthlyLast3m =
    (unitsSoldLast30d + unitsSold31To60d + unitsSold61To90d) / 3;
  const avgMonthlyTrailing12m = unitsSoldTrailing12m / 12;
  const velocityTrendPct =
    avgMonthlyTrailing12m === 0
      ? null
      : roundToTwoDecimals(
          ((avgMonthlyLast3m - avgMonthlyTrailing12m) /
            avgMonthlyTrailing12m) *
            100
        );

  const daysSinceLastSale = lastSaleDate
    ? daysBetween(new Date(lastSaleDate), referenceDate)
    : null;

  return {
    units_sold_last_30d: unitsSoldLast30d,
    units_sold_31_60d: unitsSold31To60d,
    units_sold_61_90d: unitsSold61To90d,
    units_sold_trailing_12m: unitsSoldTrailing12m,
    avg_monthly_last_3m: roundToTwoDecimals(avgMonthlyLast3m),
    avg_monthly_trailing_12m: roundToTwoDecimals(avgMonthlyTrailing12m),
    velocity_trend_pct: velocityTrendPct,
    last_sale_date: lastSaleDate,
    days_since_last_sale: daysSinceLastSale,
  };
}

export function computeSalesVelocityRows(
  products: ProductRow[],
  salesTransactions: SalesTransactionRow[],
  tenantId: string,
  referenceDate: Date = new Date()
): VwSalesVelocityRow[] {
  const salesBySku = new Map<string, SalesTransactionRow[]>();

  for (const row of salesTransactions) {
    if (!row.sku) {
      continue;
    }

    const existing = salesBySku.get(row.sku) ?? [];
    existing.push(row);
    salesBySku.set(row.sku, existing);
  }

  return products
    .filter((product) => product.sku && product.tenant_id === tenantId)
    .map((product) => {
      const sku = product.sku as string;
      const aggregated = aggregateSalesForSku(
        salesBySku.get(sku) ?? [],
        referenceDate
      );

      return {
        tenant_id: tenantId,
        sku,
        ...aggregated,
      };
    });
}
