"use client";

import { ChevronRight, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createDraftPoSelection } from "@/app/(main)/reorder/actions";
import {
  fetchReorderItemExplanation,
  type ReorderItemExplanationResult,
} from "@/app/(main)/reorder/ai-actions";
import { AiSummaryPanel } from "@/components/reorder/ai-summary-panel";
import { CoverBadge } from "@/components/reorder/months-of-cover-display";
import { ReorderExpandedPanel } from "@/components/reorder/reorder-expanded-panel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatNumber, formatSuggestedQty } from "@/lib/format";
import {
  countInactiveRecommendations,
  filterVisibleRecommendations,
  isActionableReorderStatus,
} from "@/lib/reorder-filters";
import { countReorderTabAttention } from "@/lib/reorder-tab-classification";
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";
import type {
  ReorderRecommendation,
  ReorderStatus,
  VelocityDiagnostic,
} from "@/lib/types";

type ReorderActionTabProps = {
  recommendations: ReorderRecommendation[];
  diagnosticsBySku: Record<string, VelocityDiagnostic>;
  seasonalityBySku: Record<string, ItemSeasonalityProfile>;
  onAttentionCountChange: (count: number) => void;
};

type StatusFilter = "actionable" | "all" | "critical" | "reorder" | "ok";

type SortKey =
  | "status"
  | "sku"
  | "name"
  | "quantityAvailable"
  | "suggestedQtyRounded"
  | "supplierName";

type SortDirection = "asc" | "desc";

const COLLAPSED_COLUMN_COUNT = 8;

const STATUS_ORDER: Record<ReorderStatus, number> = {
  critical: 0,
  reorder: 1,
  ok: 2,
  inactive: 3,
};

const filterSelectClassName =
  "h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#111111] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

function rowKey(rec: ReorderRecommendation): string {
  return rec.sku;
}

function matchesStatusFilter(
  status: ReorderStatus,
  filter: StatusFilter
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "actionable":
      return status === "critical" || status === "reorder";
    case "critical":
      return status === "critical";
    case "reorder":
      return status === "reorder";
    case "ok":
      return status === "ok";
  }
}

function compareValues(
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection
): number {
  const multiplier = direction === "asc" ? 1 : -1;

  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * multiplier;
  }

  return String(left).localeCompare(String(right)) * multiplier;
}

function sortRecommendations(
  rows: ReorderRecommendation[],
  sortKey: SortKey,
  direction: SortDirection
): ReorderRecommendation[] {
  const sorted = [...rows];

  sorted.sort((a, b) => {
    switch (sortKey) {
      case "status":
        return (
          (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) *
          (direction === "asc" ? 1 : -1)
        );
      case "sku":
        return compareValues(a.sku, b.sku, direction);
      case "name":
        return compareValues(a.name, b.name, direction);
      case "quantityAvailable":
        return compareValues(a.quantityAvailable, b.quantityAvailable, direction);
      case "suggestedQtyRounded":
        return compareValues(
          a.suggestedQtyRounded,
          b.suggestedQtyRounded,
          direction
        );
      case "supplierName":
        return compareValues(
          a.supplierName ?? a.supplierExternalId,
          b.supplierName ?? b.supplierExternalId,
          direction
        );
      default:
        return 0;
    }
  });

  return sorted;
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeSortKey === sortKey;
  const arrow = isActive ? (direction === "asc" ? " ^" : " v") : "";

  return (
    <TableHead className={align === "right" ? "text-right" : "text-left"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <span className="text-xs text-slate-400">{arrow}</span>
      </button>
    </TableHead>
  );
}

export function ReorderActionTab({
  recommendations,
  diagnosticsBySku,
  seasonalityBySku,
  onAttentionCountChange,
}: ReorderActionTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("actionable");
  const [showInactiveItems, setShowInactiveItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [explanationCache, setExplanationCache] = useState<
    Map<string, ReorderItemExplanationResult>
  >(new Map());
  const [explanationLoading, setExplanationLoading] = useState<Set<string>>(
    new Set()
  );
  const explanationCacheRef = useRef(explanationCache);
  const explanationLoadingRef = useRef(explanationLoading);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  explanationCacheRef.current = explanationCache;
  explanationLoadingRef.current = explanationLoading;

  const ensureExplanation = useCallback((sku: string) => {
    if (
      explanationCacheRef.current.has(sku) ||
      explanationLoadingRef.current.has(sku)
    ) {
      return;
    }

    setExplanationLoading((current) => {
      const next = new Set(current);
      next.add(sku);
      explanationLoadingRef.current = next;
      return next;
    });

    void fetchReorderItemExplanation(sku)
      .then((result) => {
        setExplanationCache((current) => {
          const next = new Map(current);
          next.set(sku, result);
          explanationCacheRef.current = next;
          return next;
        });
      })
      .catch(() => {
        setExplanationCache((current) => {
          const next = new Map(current);
          next.set(sku, {
            explanation: "Could not load explanation. Please try again.",
            source: "fallback",
            dataGaps: [],
          });
          explanationCacheRef.current = next;
          return next;
        });
      })
      .finally(() => {
        setExplanationLoading((current) => {
          const next = new Set(current);
          next.delete(sku);
          explanationLoadingRef.current = next;
          return next;
        });
      });
  }, []);

  function toggleExpanded(sku: string) {
    setExpandedSkus((current) => {
      const next = new Set(current);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
        ensureExplanation(sku);
      }
      return next;
    });
  }

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    for (const rec of recommendations) {
      const label = rec.supplierName ?? rec.supplierExternalId;
      if (label) {
        names.add(label);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [recommendations]);

  const inactiveCount = useMemo(
    () => countInactiveRecommendations(recommendations),
    [recommendations]
  );

  const visibleRecommendations = useMemo(
    () => filterVisibleRecommendations(recommendations, showInactiveItems),
    [recommendations, showInactiveItems]
  );

  const summaryCounts = useMemo(() => {
    return visibleRecommendations.reduce(
      (counts, rec) => {
        if (rec.status === "inactive") {
          return counts;
        }

        counts[rec.status] += 1;
        return counts;
      },
      { critical: 0, reorder: 0, ok: 0 }
    );
  }, [visibleRecommendations]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return visibleRecommendations.filter((rec) => {
      if (!matchesStatusFilter(rec.status, statusFilter)) {
        return false;
      }

      const supplierLabel = rec.supplierName ?? rec.supplierExternalId ?? "";
      if (supplierFilter !== "all" && supplierLabel !== supplierFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });
  }, [visibleRecommendations, searchQuery, statusFilter, supplierFilter]);

  const sortedRows = useMemo(
    () => sortRecommendations(filteredRows, sortKey, sortDirection),
    [filteredRows, sortKey, sortDirection]
  );

  const filterDescription = useMemo(() => {
    const parts = [`${filteredRows.length} reorderable item(s) in view`];

    if (statusFilter !== "all") {
      parts.push(`status filter: ${statusFilter}`);
    }

    if (supplierFilter !== "all") {
      parts.push(`supplier: ${supplierFilter}`);
    }

    if (searchQuery.trim()) {
      parts.push(`search: "${searchQuery.trim()}"`);
    }

    return parts.join("; ");
  }, [filteredRows.length, searchQuery, statusFilter, supplierFilter]);

  const selectedRows = useMemo(
    () => visibleRecommendations.filter((rec) => selectedKeys.has(rowKey(rec))),
    [visibleRecommendations, selectedKeys]
  );

  const vendorPoCount = useMemo(() => {
    const suppliers = new Set<string>();
    for (const rec of selectedRows) {
      suppliers.add(rec.supplierName ?? rec.supplierExternalId ?? "unknown");
    }
    return suppliers.size;
  }, [selectedRows]);

  const filteredAttentionCount = useMemo(
    () => countReorderTabAttention(filteredRows),
    [filteredRows]
  );

  useEffect(() => {
    onAttentionCountChange(filteredAttentionCount);
  }, [filteredAttentionCount, onAttentionCountChange]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function toggleRowSelection(rec: ReorderRecommendation) {
    const key = rowKey(rec);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAllCriticalAndReorder() {
    const next = new Set<string>();
    for (const rec of sortedRows) {
      if (isActionableReorderStatus(rec.status)) {
        next.add(rowKey(rec));
      }
    }
    setSelectedKeys(next);
  }

  function handleGeneratePurchaseOrders() {
    setActionError(null);

    const items = selectedRows.map((rec) => ({
      sku: rec.sku,
      supplierExternalId: rec.supplierExternalId,
      suggestedQty: rec.suggestedQtyRounded,
    }));

    startTransition(async () => {
      const result = await createDraftPoSelection(items);
      if (!result.success) {
        setActionError(result.error ?? "Failed to save draft PO selection");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 px-1">
        <span className="rounded-full border border-[#FCA5A5] bg-[#FDF2F2] px-2.5 py-0.5 text-xs font-medium text-[#CC2B2B]">
          {summaryCounts.critical} Critical
        </span>
        <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309]">
          {summaryCounts.reorder} Reorder Needed
        </span>
        <span className="rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#16A34A]">
          {summaryCounts.ok} OK
        </span>
        {inactiveCount > 0 ? (
          <Badge variant="neutral">
            {inactiveCount} inactive items hidden
          </Badge>
        ) : null}
      </div>

      <AiSummaryPanel
        filteredRecommendations={filteredRows}
        diagnosticsBySku={diagnosticsBySku}
        filterDescription={filterDescription}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-transparent bg-white p-4 shadow-card">
        <div className="min-w-[180px]">
          <label
            htmlFor="status-filter"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            className={`${filterSelectClassName} w-full min-w-[180px]`}
          >
            <option value="actionable">Critical + Reorder Needed</option>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="reorder">Reorder Needed</option>
            <option value="ok">OK</option>
          </select>
        </div>

        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="search-filter"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="search-filter"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search SKU or name"
              className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white py-2 pl-9 pr-3 text-sm text-[#111111] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20"
            />
          </div>
        </div>

        <div className="min-w-[180px]">
          <label
            htmlFor="supplier-filter"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]"
          >
            Supplier
          </label>
          <select
            id="supplier-filter"
            value={supplierFilter}
            onChange={(event) => setSupplierFilter(event.target.value)}
            className={`${filterSelectClassName} w-full min-w-[180px]`}
          >
            <option value="all">All suppliers</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Inactive items
          </label>
          <label className="flex h-10 items-center gap-2 rounded-2xl border border-transparent shadow-card bg-white px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showInactiveItems}
              onChange={(event) => setShowInactiveItems(event.target.checked)}
              className="h-4 w-4 rounded border-[#E5E7EB] text-tbc-red focus:ring-tbc-red/20"
            />
            Show inactive items
            {inactiveCount > 0 ? (
              <span className="text-xs text-slate-500">({inactiveCount})</span>
            ) : null}
          </label>
        </div>

        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Selection
          </label>
          <button
            type="button"
            onClick={selectAllCriticalAndReorder}
            className="h-10 w-full rounded-2xl border border-transparent shadow-card bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Select All Critical + Reorder
          </button>
        </div>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {actionError}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        {sortedRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No rows match the current filters.
          </div>
        ) : (
          <Table containerClassName="rounded-none border-0">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Select</TableHead>
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="SKU"
                  sortKey="sku"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Product Name"
                  sortKey="name"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Qty Available"
                  sortKey="quantityAvailable"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Suggested Qty"
                  sortKey="suggestedQtyRounded"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHeader
                  label="Supplier"
                  sortKey="supplierName"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <TableHead>Months of Cover</TableHead>
                <TableHead className="w-10 text-right">
                  <span className="sr-only">Expand</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((rec) => {
                const key = rowKey(rec);
                const isSelected = selectedKeys.has(key);
                const isExpanded = expandedSkus.has(key);
                const seasonalityProfile = seasonalityBySku[rec.sku] ?? null;

                return (
                  <Fragment key={key}>
                    <TableRow
                      className={`cursor-pointer [&>td]:py-2 ${
                        isExpanded ? "bg-slate-50 hover:bg-slate-50" : ""
                      }`}
                      onClick={(event) => {
                        const target = event.target;
                        if (
                          target instanceof HTMLInputElement &&
                          target.type === "checkbox"
                        ) {
                          return;
                        }

                        toggleExpanded(key);
                      }}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={rec.status === "inactive"}
                          onChange={() => toggleRowSelection(rec)}
                          aria-label={`Select ${rec.sku}`}
                          className="h-4 w-4 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(rec.status)}>
                          {getStatusLabel(rec.status)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[220px]"
                        title={`${rec.sku}${rec.name ? ` - ${rec.name}` : ""}`}
                      >
                        <div className="leading-tight">
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            {rec.sku}
                          </p>
                          <p className="line-clamp-1 text-xs text-slate-500">
                            {rec.name ?? "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(rec.quantityAvailable)}
                      </TableCell>
                      <TableCell>
                        <CoverBadge rec={rec} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                        {formatSuggestedQty(rec.suggestedQtyRounded)}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {rec.supplierName ?? rec.supplierExternalId ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight
                          className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={COLLAPSED_COLUMN_COUNT} className="p-0">
                          <ReorderExpandedPanel
                            rec={rec}
                            pipeline={rec.pipelineBreakdown}
                            seasonalityProfile={seasonalityProfile}
                            explanation={explanationCache.get(key) ?? null}
                            isLoadingExplanation={explanationLoading.has(key)}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="sticky bottom-0 z-40 -mx-2 flex items-center justify-between rounded-2xl border border-transparent shadow-card bg-white px-6 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <p className="text-sm text-slate-700">
          {selectedRows.length} item{selectedRows.length === 1 ? "" : "s"}{" "}
          selected across {vendorPoCount} supplier
          {vendorPoCount === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          disabled={isPending || selectedRows.length === 0}
          onClick={handleGeneratePurchaseOrders}
          className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-tbc-red-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving selection..." : "Generate Purchase Orders"}
        </button>
      </div>
    </div>
  );
}
