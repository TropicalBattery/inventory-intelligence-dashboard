import { toNumber } from "@/lib/format";

export type PipelineBreakdown = {
  inTransit: number;
  inBond: number;
  atPort: number;
  inClearing: number;
};

export function parsePipelineBreakdown(
  row: Record<string, unknown>
): PipelineBreakdown {
  const hasComponentColumns =
    "quantity_in_transit" in row ||
    "quantity_in_bond" in row ||
    "quantity_at_port" in row ||
    "quantity_in_clearing" in row;

  if (hasComponentColumns) {
    return {
      inTransit: toNumber(row.quantity_in_transit as number | string | null),
      inBond: toNumber(row.quantity_in_bond as number | string | null),
      atPort: toNumber(row.quantity_at_port as number | string | null),
      inClearing: toNumber(row.quantity_in_clearing as number | string | null),
    };
  }

  return {
    inTransit: 0,
    inBond: 0,
    atPort: 0,
    inClearing: 0,
  };
}
