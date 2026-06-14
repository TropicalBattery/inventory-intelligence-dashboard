export function resolveUnitCostFromSources(
  referenceUnitPrice: number | null | undefined,
  productCostPrice: number | null | undefined
): number | null {
  if (referenceUnitPrice !== null && referenceUnitPrice !== undefined) {
    return referenceUnitPrice;
  }

  if (productCostPrice !== null && productCostPrice !== undefined) {
    return productCostPrice;
  }

  return null;
}

export function normalizeStoredLineCost(
  unitCostRaw: number | null | undefined,
  quantityOrdered: number,
  lineTotalRaw: number | null | undefined
): { unitCost: number | null; lineTotal: number | null } {
  if (unitCostRaw === null || unitCostRaw === undefined) {
    return { unitCost: null, lineTotal: null };
  }

  const unitCost = Number(unitCostRaw);
  const lineTotal =
    lineTotalRaw === null || lineTotalRaw === undefined
      ? null
      : Number(lineTotalRaw);

  if (
    unitCost === 0 &&
    quantityOrdered > 0 &&
    (lineTotal === null || lineTotal === 0)
  ) {
    return { unitCost: null, lineTotal: null };
  }

  return {
    unitCost,
    lineTotal:
      lineTotal !== null && !Number.isNaN(lineTotal)
        ? lineTotal
        : unitCost * quantityOrdered,
  };
}

export function computeLineTotal(
  quantity: number,
  unitCost: number | null
): number | null {
  if (unitCost === null) {
    return null;
  }

  return quantity * unitCost;
}

export function sumKnownLineTotals(
  lines: Array<{ lineTotal: number | null }>
): number {
  return lines.reduce(
    (sum, line) => sum + (line.lineTotal ?? 0),
    0
  );
}

export function hasUnknownLineCosts(
  lines: Array<{ unitCost: number | null }>
): boolean {
  return lines.some((line) => line.unitCost === null);
}
