import type { ParsedInboundContainer } from "@/lib/inbound-containers/parse";

export type InboundEntrySource = "upload" | "manual";
export type InboundContainerStatus = "inbound" | "arrived";

export type InboundContainerRecord = {
  id: string;
  tenantId: string;
  supplier: string;
  supplierInvoice: string | null;
  quoteRef: string | null;
  containerCount: number | null;
  containerSize: string | null;
  etaPort: string | null;
  etaWarehouse: string | null;
  blNumber: string | null;
  containerNumbers: string | null;
  sourceMonth: string | null;
  loadedAt: string;
  entrySource: InboundEntrySource;
  status: InboundContainerStatus;
  arrivedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type InboundContainerSupplierGroup = {
  supplier: string;
  /** Sum of container_count for status='inbound' rows only. */
  containerCountTotal: number;
  /** Sum of container_count for status='arrived' rows. */
  arrivedCountTotal: number;
  rows: InboundContainerRecord[];
};

export type InboundContainersSummary = {
  /** Inbound (not yet arrived) container count — primary pill. */
  totalContainers: number;
  /** Arrived container count — secondary pill. */
  arrivedContainers: number;
  supplierCount: number;
  /** Size breakdown for inbound rows only. */
  bySize: Record<string, number>;
  loadedAt: string | null;
  sourceMonth: string | null;
  groups: InboundContainerSupplierGroup[];
};

export function mapParsedToInsertRow(
  row: ParsedInboundContainer,
  tenantId: string,
  loadedAt: string
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    supplier: row.supplier,
    supplier_invoice: row.supplierInvoice,
    quote_ref: row.quoteRef,
    container_count: row.containerCount,
    container_size: row.containerSize,
    eta_port: row.etaPort,
    eta_warehouse: row.etaWarehouse,
    bl_number: row.blNumber,
    container_numbers: row.containerNumbers,
    source_month: row.sourceMonth,
    loaded_at: loadedAt,
    entry_source: "upload",
    status: "inbound",
    arrived_at: null,
    created_by: null,
    updated_by: null,
    updated_at: loadedAt,
  };
}

function statusSortRank(status: InboundContainerStatus): number {
  return status === "inbound" ? 0 : 1;
}

export function groupInboundContainers(
  rows: InboundContainerRecord[]
): InboundContainersSummary {
  const bySupplier = new Map<string, InboundContainerRecord[]>();
  const bySize: Record<string, number> = {};
  let totalContainers = 0;
  let arrivedContainers = 0;
  let loadedAt: string | null = null;
  let sourceMonth: string | null = null;

  for (const row of rows) {
    const list = bySupplier.get(row.supplier) ?? [];
    list.push(row);
    bySupplier.set(row.supplier, list);

    const count =
      row.containerCount !== null && Number.isFinite(row.containerCount)
        ? Number(row.containerCount)
        : 0;

    if (row.status === "arrived") {
      arrivedContainers += count;
    } else {
      totalContainers += count;

      const sizeRaw = row.containerSize?.trim() ?? "";
      // Only real container sizes (e.g. 20FT, 40FT) — ignore stray subtotal tokens.
      if (/^\d+FT/i.test(sizeRaw)) {
        const sizeKey = sizeRaw.toUpperCase();
        bySize[sizeKey] = (bySize[sizeKey] ?? 0) + count;
      }
    }

    if (!loadedAt || row.loadedAt > loadedAt) {
      loadedAt = row.loadedAt;
    }
    if (!sourceMonth && row.sourceMonth) {
      sourceMonth = row.sourceMonth;
    }
  }

  const groups: InboundContainerSupplierGroup[] = Array.from(
    bySupplier.entries()
  )
    .map(([supplier, supplierRows]) => {
      let containerCountTotal = 0;
      let arrivedCountTotal = 0;
      for (const row of supplierRows) {
        const count =
          row.containerCount !== null && Number.isFinite(row.containerCount)
            ? Number(row.containerCount)
            : 0;
        if (row.status === "arrived") {
          arrivedCountTotal += count;
        } else {
          containerCountTotal += count;
        }
      }

      return {
        supplier,
        containerCountTotal,
        arrivedCountTotal,
        // inbound first, arrived last; then ETA ascending within each status.
        rows: [...supplierRows].sort((a, b) => {
          const byStatus = statusSortRank(a.status) - statusSortRank(b.status);
          if (byStatus !== 0) return byStatus;
          const etaA = a.etaPort ?? "";
          const etaB = b.etaPort ?? "";
          return etaA.localeCompare(etaB);
        }),
      };
    })
    .sort((a, b) => a.supplier.localeCompare(b.supplier));

  return {
    totalContainers,
    arrivedContainers,
    supplierCount: groups.length,
    bySize,
    loadedAt,
    sourceMonth,
    groups,
  };
}
