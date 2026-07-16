"use client";

import { ChevronRight, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchReorderItemExplanation,
  type ReorderItemExplanationResult,
} from "@/app/(main)/reorder/ai-actions";
import { usePoCart } from "@/components/po-cart/po-cart-provider";
import { AiSummaryPanel } from "@/components/reorder/ai-summary-panel";
import { CoverBadge } from "@/components/reorder/months-of-cover-display";
import { ReorderExpandedPanel } from "@/components/reorder/reorder-expanded-panel";
import { SavedViewsControls } from "@/components/reorder/saved-views-controls";
import {
  ListingToolbar,
  listingControlClassName,
  listingExportButtonClassName,
  listingLabelClassName,
  listingSearchInputClassName,
} from "@/components/shared/listing-toolbar";
import { MultiSelectFilter } from "@/components/shared/multi-select-filter";
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
  type AbcClass,
} from "@/lib/reorder/abc";
import {
  countNoDemandRecommendations,
  filterMainRecommendations,
  filterNoDemandRecommendations,
  sortReorderActionRows,
  summarizeReorderStatuses,
} from "@/lib/reorder-filters";
import {
  getDoNotBuyBadgeMeta,
  isPurchaseBlockedRule,
  resolveCartSupplierForRule,
} from "@/lib/reorder/purchase-rules-ui";
import { countReorderTabAttention } from "@/lib/reorder-tab-classification";
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import {
  downloadBytesFile,
  downloadTextFile,
} from "@/lib/reorder/download-client";
import {
  buildReorderExportCsv,
  buildReorderExportFilename,
  buildReorderExportPdf,
  buildReorderExportRows,
} from "@/lib/reorder/export";
import {
  DEFAULT_REORDER_ACTION_VIEW_FILTERS,
  parseReorderActionViewFilters,
  reorderActionViewFiltersEqual,
  type AbcClassFilter,
  type ReorderActionViewFilters,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from "@/lib/reorder/view-filters";
import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";
import type {
  ReorderRecommendation,
  ReorderStatus,
  VelocityDiagnostic,
} from "@/lib/types";
import {
  formatSupplierOptionLabel,
  resolveSupplierDisplayName,
  type SupplierFilterOption,
} from "@/lib/queries/suppliers";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "watch", label: "Watch" },
  { value: "reorder_needed", label: "Reorder Needed" },
  { value: "ok", label: "OK (well stocked)" },
];

const ABC_CLASS_FILTER_OPTIONS: { value: AbcClassFilter; label: string }[] = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

type ReorderActionTabProps = {
  recommendations: ReorderRecommendation[];
  diagnosticsBySku: Record<string, VelocityDiagnostic>;
  seasonalityBySku: Record<string, ItemSeasonalityProfile>;
  onAttentionCountChange: (count: number) => void;
  /** When set, show muted "active inventory only" note in the filter bar. */
  activeInventorySkuCount?: number | null;
  /** Full vendor list for the filter (refs + locks + names). */
  supplierFilterOptions?: SupplierFilterOption[];
};

type FilterBarSort =
  | "urgency"
  | "sku-asc"
  | "qty-available-asc"
  | "suggested-qty-desc";

const COLLAPSED_COLUMN_COUNT = 9;

const STATUS_ORDER: Record<ReorderStatus, number> = {
  critical: 0,
  watch: 1,
  reorder_needed: 2,
  ok: 3,
  no_demand: 4,
};

const ABC_ROW_BADGE_BASE =
  "inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold ml-2 align-middle";

const ABC_ROW_BADGE_TONE: Record<Exclude<AbcClass, null>, string> = {
  A: "bg-[#111111] text-white",
  B: "bg-[#6B7280] text-white",
  C: "bg-[#E5E7EB] text-[#6B7280]",
};

const ABC_ROW_BADGE_TITLE: Record<Exclude<AbcClass, null>, string> = {
  A: "Class A - top sellers (~80% of sales value)",
  B: "Class B - mid movers",
  C: "Class C - long tail",
};

function rowKey(rec: ReorderRecommendation): string {
  return rec.sku;
}

const coverMonths = (rec: ReorderRecommendation): number => {
  if (!rec.avgDailyDemandUnits || rec.avgDailyDemandUnits <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (
    (rec.quantityAvailable + rec.quantityOnOrder) /
    (rec.avgDailyDemandUnits * 30.44)
  );
};

function filterBarSortFromState(
  sortKey: SortKey,
  direction: SortDirection
): FilterBarSort | "" {
  if (sortKey === "coverMonths" && direction === "asc") {
    return "urgency";
  }
  if (sortKey === "sku" && direction === "asc") {
    return "sku-asc";
  }
  if (sortKey === "quantityAvailable" && direction === "asc") {
    return "qty-available-asc";
  }
  if (sortKey === "suggestedQtyRounded" && direction === "desc") {
    return "suggested-qty-desc";
  }
  return "";
}

function applyFilterBarSort(option: FilterBarSort): {
  sortKey: SortKey;
  sortDirection: SortDirection;
} {
  switch (option) {
    case "urgency":
      return { sortKey: "coverMonths", sortDirection: "asc" };
    case "sku-asc":
      return { sortKey: "sku", sortDirection: "asc" };
    case "qty-available-asc":
      return { sortKey: "quantityAvailable", sortDirection: "asc" };
    case "suggested-qty-desc":
      return { sortKey: "suggestedQtyRounded", sortDirection: "desc" };
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
  if (sortKey === "status") {
    const sorted = sortReorderActionRows(rows);
    return direction === "desc" ? sorted.reverse() : sorted;
  }

  const sorted = [...rows];

  sorted.sort((a, b) => {
    switch (sortKey) {
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
      case "coverMonths":
        return compareValues(coverMonths(a), coverMonths(b), direction);
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
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = activeSortKey === sortKey;
  const arrow = isActive ? (direction === "asc" ? " ^" : " v") : "";

  return (
    <TableHead
      className={[
        align === "right" ? "text-right" : "text-left",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
  activeInventorySkuCount = null,
  supplierFilterOptions = [],
}: ReorderActionTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter[]>(() => [
    ...DEFAULT_REORDER_ACTION_VIEW_FILTERS.statusFilter,
  ]);
  const [abcClassFilter, setAbcClassFilter] = useState<AbcClassFilter[]>(
    () => [...DEFAULT_REORDER_ACTION_VIEW_FILTERS.abcClassFilter]
  );
  const [showNoDemandItems, setShowNoDemandItems] = useState(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.showNoDemandItems
  );
  const [searchQuery, setSearchQuery] = useState(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.searchQuery
  );
  const [supplierFilter, setSupplierFilter] = useState<string[]>(() => [
    ...DEFAULT_REORDER_ACTION_VIEW_FILTERS.supplierFilter,
  ]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkOpenPoConfirmPending, setBulkOpenPoConfirmPending] =
    useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.sortKey
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.sortDirection
  );
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
  const [isPending, setIsPending] = useState(false);
  const [isExporting, setIsExporting] = useState<"csv" | "pdf" | null>(null);
  const { addItems, open: openPoCart } = usePoCart();

  const currentViewFilters = useMemo<ReorderActionViewFilters>(
    () => ({
      statusFilter,
      abcClassFilter,
      showNoDemandItems,
      searchQuery,
      supplierFilter,
      sortKey,
      sortDirection,
    }),
    [
      statusFilter,
      abcClassFilter,
      showNoDemandItems,
      searchQuery,
      supplierFilter,
      sortKey,
      sortDirection,
    ]
  );

  const applyViewFilters = useCallback((next: ReorderActionViewFilters) => {
    setStatusFilter([...next.statusFilter]);
    setAbcClassFilter([...next.abcClassFilter]);
    setShowNoDemandItems(next.showNoDemandItems);
    setSearchQuery(next.searchQuery);
    setSupplierFilter([...next.supplierFilter]);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  }, []);

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
    const byId = new Map<string, SupplierFilterOption>();

    for (const option of supplierFilterOptions) {
      byId.set(option.externalId, option);
    }

    for (const rec of recommendations) {
      const id = rec.supplierExternalId?.trim();
      if (!id || byId.has(id)) {
        continue;
      }
      byId.set(id, {
        externalId: id,
        name: rec.supplierName?.trim() || null,
      });
    }

    return Array.from(byId.values()).sort((left, right) => {
      const leftLabel = (left.name ?? left.externalId).toLocaleLowerCase();
      const rightLabel = (right.name ?? right.externalId).toLocaleLowerCase();
      return leftLabel.localeCompare(rightLabel);
    });
  }, [recommendations, supplierFilterOptions]);

  const noDemandCount = useMemo(
    () => countNoDemandRecommendations(recommendations),
    [recommendations]
  );

  const mainRecommendations = useMemo(
    () => filterMainRecommendations(recommendations),
    [recommendations]
  );

  const summaryCounts = useMemo(
    () => summarizeReorderStatuses(recommendations),
    [recommendations]
  );

  const filteredMainRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const statusSet =
      statusFilter.length > 0 ? new Set<string>(statusFilter) : null;
    const abcSet =
      abcClassFilter.length > 0 ? new Set<string>(abcClassFilter) : null;
    const supplierSet =
      supplierFilter.length > 0 ? new Set(supplierFilter) : null;

    return mainRecommendations.filter((rec) => {
      if (statusSet && !statusSet.has(rec.status)) {
        return false;
      }

      if (abcSet && (rec.abcClass == null || !abcSet.has(rec.abcClass))) {
        return false;
      }

      if (supplierSet && !supplierSet.has(rec.supplierExternalId ?? "")) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });
  }, [
    mainRecommendations,
    searchQuery,
    statusFilter,
    abcClassFilter,
    supplierFilter,
  ]);

  const filteredNoDemandRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const supplierSet =
      supplierFilter.length > 0 ? new Set(supplierFilter) : null;

    return filterNoDemandRecommendations(recommendations).filter((rec) => {
      if (supplierSet && !supplierSet.has(rec.supplierExternalId ?? "")) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });
  }, [recommendations, searchQuery, supplierFilter]);

  const sortedMainRows = useMemo(
    () => sortRecommendations(filteredMainRows, sortKey, sortDirection),
    [filteredMainRows, sortKey, sortDirection]
  );

  const sortedNoDemandRows = useMemo(
    () => sortRecommendations(filteredNoDemandRows, "sku", "asc"),
    [filteredNoDemandRows]
  );

  const filterDescription = useMemo(() => {
    const parts = [`${sortedMainRows.length} reorderable item(s) in view`];

    if (statusFilter.length > 0) {
      parts.push(`status filter: ${statusFilter.join(", ")}`);
    }

    if (abcClassFilter.length > 0) {
      parts.push(`ABC class: ${abcClassFilter.join(", ")}`);
    }

    if (supplierFilter.length > 0) {
      const labels = supplierFilter.map((id) => {
        const selected = supplierOptions.find(
          (option) => option.externalId === id
        );
        return selected
          ? formatSupplierOptionLabel(selected.name, selected.externalId)
          : id;
      });
      parts.push(`supplier: ${labels.join(", ")}`);
    }

    if (searchQuery.trim()) {
      parts.push(`search: "${searchQuery.trim()}"`);
    }

    return parts.join("; ");
  }, [
    sortedMainRows.length,
    searchQuery,
    statusFilter,
    abcClassFilter,
    supplierFilter,
    supplierOptions,
  ]);

  const supplierMultiSelectOptions = useMemo(
    () =>
      supplierOptions.map((supplier) => ({
        value: supplier.externalId,
        label: formatSupplierOptionLabel(supplier.name, supplier.externalId),
      })),
    [supplierOptions]
  );

  const selectedRows = useMemo(
    () => mainRecommendations.filter((rec) => selectedKeys.has(rowKey(rec))),
    [mainRecommendations, selectedKeys]
  );

  const bulkOpenPoAffected = useMemo(
    () =>
      selectedRows.filter(
        (rec) =>
          rec.openPoQty > 0 &&
          Number.isFinite(rec.openPoQty) &&
          rec.suggestedQtyRounded > 0 &&
          !isPurchaseBlockedRule(rec.purchaseRule)
      ),
    [selectedRows]
  );

  const vendorPoCount = useMemo(() => {
    const suppliers = new Set<string>();
    for (const rec of selectedRows) {
      suppliers.add(rec.supplierName ?? rec.supplierExternalId ?? "unknown");
    }
    return suppliers.size;
  }, [selectedRows]);

  const selectableVisibleKeys = useMemo(
    () =>
      sortedMainRows
        .filter(
          (rec) =>
            rec.status !== "no_demand" &&
            !isPurchaseBlockedRule(rec.purchaseRule)
        )
        .map((rec) => rowKey(rec)),
    [sortedMainRows]
  );

  const allVisibleSelected =
    selectableVisibleKeys.length > 0 &&
    selectableVisibleKeys.every((key) => selectedKeys.has(key));

  const someVisibleSelected = selectableVisibleKeys.some((key) =>
    selectedKeys.has(key)
  );

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onAttentionCountChange(countReorderTabAttention(recommendations));
  }, [recommendations, onAttentionCountChange]);

  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (!el) {
      return;
    }
    el.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

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
    setBulkOpenPoConfirmPending(false);
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

  function toggleSelectAllVisible() {
    setBulkOpenPoConfirmPending(false);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const key of selectableVisibleKeys) {
          next.delete(key);
        }
      } else {
        for (const key of selectableVisibleKeys) {
          next.add(key);
        }
      }
      return next;
    });
  }

  async function handleAddSelectedToPo() {
    setActionError(null);

    const items = selectedRows
      .filter(
        (rec) =>
          rec.suggestedQtyRounded > 0 && !isPurchaseBlockedRule(rec.purchaseRule)
      )
      .map((rec) => ({
        sku: rec.sku,
        productName: rec.name,
        quantity: rec.suggestedQtyRounded,
        supplierExternalId: resolveCartSupplierForRule(
          rec.purchaseRule,
          rec.supplierExternalId
        ),
        unitPrice: rec.supplierUnitPrice,
        sourceStatus: rec.status,
      }));

    if (items.length === 0) {
      setActionError(
        "Selected items need a suggested quantity greater than 0 (blocked purchase rules are excluded)"
      );
      return;
    }

    const affectedOpenPo = selectedRows.filter(
      (rec) =>
        rec.openPoQty > 0 &&
        rec.suggestedQtyRounded > 0 &&
        !isPurchaseBlockedRule(rec.purchaseRule)
    );

    if (affectedOpenPo.length > 0 && !bulkOpenPoConfirmPending) {
      setBulkOpenPoConfirmPending(true);
      return;
    }

    setBulkOpenPoConfirmPending(false);
    setIsPending(true);
    try {
      await addItems(items);
      openPoCart();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Failed to add selected items to cart"
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleExport(format: "csv" | "pdf") {
    if (isExporting) {
      return;
    }

    setActionError(null);
    setIsExporting(format);

    try {
      const generatedAt = new Date();
      const exportRows = buildReorderExportRows(sortedMainRows);
      const meta = {
        filterDescription,
        generatedAt,
        title: "Reorder Action Report",
      };

      if (format === "csv") {
        const csv = buildReorderExportCsv(exportRows, meta);
        downloadTextFile(
          buildReorderExportFilename("csv", generatedAt),
          csv,
          "text/csv;charset=utf-8"
        );
      } else {
        const pdfBytes = await buildReorderExportPdf(exportRows, meta);
        downloadBytesFile(
          buildReorderExportFilename("pdf", generatedAt),
          pdfBytes,
          "application/pdf"
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Failed to export ${format.toUpperCase()}`
      );
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 px-1">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#FCA5A5] bg-[#FDF2F2] px-2.5 py-0.5 text-xs font-medium text-[#CC2B2B]">
            {summaryCounts.critical} Critical
          </span>
          <span className="rounded-full border border-[#B8D9F0] bg-[#E6F1FB] px-2.5 py-0.5 text-xs font-medium text-[#185FA5]">
            {summaryCounts.watch} Watch
          </span>
          <span className="rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#16A34A]">
            {summaryCounts.ok} OK
          </span>
          <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309]">
            {summaryCounts.reorder_needed} Reorder Needed
          </span>
        </div>
      </div>

      <AiSummaryPanel
        filteredRecommendations={sortedMainRows}
        diagnosticsBySku={diagnosticsBySku}
        filterDescription={filterDescription}
      />

      <div>
        <ListingToolbar
          filters={
            <>
              <MultiSelectFilter
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                selected={statusFilter}
                onChange={(values) =>
                  setStatusFilter(values as StatusFilter[])
                }
                placeholder="All statuses"
                className="min-w-[180px]"
              />
              <MultiSelectFilter
                label="Class"
                options={ABC_CLASS_FILTER_OPTIONS}
                selected={abcClassFilter}
                onChange={(values) =>
                  setAbcClassFilter(values as AbcClassFilter[])
                }
                placeholder="All classes"
                className="min-w-[140px]"
              />
              <MultiSelectFilter
                label="Supplier"
                options={supplierMultiSelectOptions}
                selected={supplierFilter}
                onChange={setSupplierFilter}
                placeholder="All suppliers"
                className="min-w-[180px]"
              />
            </>
          }
          search={
            <>
              <label htmlFor="search-filter" className={listingLabelClassName}>
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
                  className={listingSearchInputClassName}
                />
              </div>
            </>
          }
          sort={
            <div className="min-w-[180px]">
              <label htmlFor="sort-filter" className={listingLabelClassName}>
                Sort
              </label>
              <select
                id="sort-filter"
                value={filterBarSortFromState(sortKey, sortDirection)}
                onChange={(event) => {
                  const next = event.target.value as FilterBarSort;
                  const applied = applyFilterBarSort(next);
                  setSortKey(applied.sortKey);
                  setSortDirection(applied.sortDirection);
                }}
                className={`${listingControlClassName} w-full min-w-[180px]`}
              >
                <option value="" disabled hidden>
                  Custom
                </option>
                <option value="urgency">Most urgent first</option>
                <option value="sku-asc">SKU A-Z</option>
                <option value="qty-available-asc">
                  Qty available (low to high)
                </option>
                <option value="suggested-qty-desc">
                  Suggested qty (high to low)
                </option>
              </select>
            </div>
          }
          actions={
            <>
              <SavedViewsControls
                page="reorder_action"
                filters={currentViewFilters}
                defaultFilters={DEFAULT_REORDER_ACTION_VIEW_FILTERS}
                onApply={applyViewFilters}
                onError={setActionError}
                parseFilters={parseReorderActionViewFilters}
                filtersEqual={reorderActionViewFiltersEqual}
                suggestName={(f) => {
                  if (f.supplierFilter.length > 0) {
                    const statusPart =
                      f.statusFilter.length > 0
                        ? f.statusFilter.join("+")
                        : "all";
                    return `${statusPart} · ${f.supplierFilter.join("+")}`;
                  }
                  if (f.statusFilter.length > 0) {
                    return `${f.statusFilter.join("+")} view`;
                  }
                  return "all statuses view";
                }}
                defaultHint="Apply this view automatically when you open Reorder Action"
              />
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void handleExport("csv");
                  }}
                  disabled={isExporting !== null}
                  className={listingExportButtonClassName}
                  title="Download the currently filtered rows as CSV for Excel"
                >
                  {isExporting === "csv" ? "Exporting…" : "Export CSV"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleExport("pdf");
                  }}
                  disabled={isExporting !== null}
                  className={listingExportButtonClassName}
                  title="Download a PDF pack of the currently filtered rows"
                >
                  {isExporting === "pdf" ? "Exporting…" : "Export PDF"}
                </button>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-[#6B7280]">
                <input
                  type="checkbox"
                  checked={showNoDemandItems}
                  onChange={(event) =>
                    setShowNoDemandItems(event.target.checked)
                  }
                  className="h-3.5 w-3.5 rounded border-[#E5E7EB] text-tbc-red focus:ring-tbc-red/20"
                />
                Include {noDemandCount.toLocaleString("en-JM")} no-demand SKUs
              </label>
            </>
          }
          meta={
            <p title="Sourced from the buyer's Order Tool item master">
              {activeInventorySkuCount != null && activeInventorySkuCount > 0
                ? `Showing active inventory only (${activeInventorySkuCount.toLocaleString("en-US")} SKUs)`
                : "\u00a0"}
            </p>
          }
        />
        <p className="mt-2 text-xs text-[#9CA3AF]">
          Bands scale with each item&apos;s supplier lead time; standard bands
          apply when no lead time is on file.
        </p>

        {actionError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {actionError}
          </div>
        ) : null}

        <Card className="mt-4 rounded-2xl p-0">
        {sortedMainRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No rows match the current filters.
          </div>
        ) : (
          <Table containerClassName="rounded-2xl border-0 !overflow-visible">
            <TableHeader className="bg-[#F9FAFB] [&_th]:sticky [&_th]:top-[5.125rem] [&_th]:z-20 [&_th]:bg-[#F9FAFB]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={selectableVisibleKeys.length === 0}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible rows"
                    className="h-4 w-4 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </TableHead>
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="w-32"
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
                  className="max-w-[180px]"
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
              {sortedMainRows.map((rec) => {
                const key = rowKey(rec);
                const isSelected = selectedKeys.has(key);
                const isExpanded = expandedSkus.has(key);
                const seasonalityProfile = seasonalityBySku[rec.sku] ?? null;
                const doNotBuyBadge = getDoNotBuyBadgeMeta(rec.purchaseRule);
                const purchaseBlocked = isPurchaseBlockedRule(rec.purchaseRule);

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
                          disabled={
                            rec.status === "no_demand" || purchaseBlocked
                          }
                          onChange={() => toggleRowSelection(rec)}
                          aria-label={`Select ${rec.sku}`}
                          title={
                            purchaseBlocked
                              ? doNotBuyBadge?.title
                              : undefined
                          }
                          className="h-4 w-4 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </TableCell>
                      <TableCell className="w-32">
                        <span className="inline-flex flex-col items-start gap-1">
                          <Badge
                            variant={getStatusBadgeVariant(rec.status)}
                            className="whitespace-nowrap"
                          >
                            {getStatusLabel(rec.status)}
                          </Badge>
                          {doNotBuyBadge ? (
                            <span
                              className={doNotBuyBadge.className}
                              title={doNotBuyBadge.title}
                            >
                              {doNotBuyBadge.label}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold text-slate-900">
                        <span className="flex items-center gap-2">
                          {rec.sku}
                          {rec.abcClass ? (
                            <span
                              className={`${ABC_ROW_BADGE_BASE} ${ABC_ROW_BADGE_TONE[rec.abcClass]}`}
                              title={ABC_ROW_BADGE_TITLE[rec.abcClass]}
                            >
                              {rec.abcClass}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate text-sm text-slate-700"
                        title={rec.name ?? undefined}
                      >
                        <span className="inline-flex max-w-full items-center gap-1.5">
                          <span className="truncate">{rec.name ?? "-"}</span>
                          {rec.seasonality?.isSeasonal ? (
                            <i
                              className="ti ti-calendar-stats shrink-0 text-sm text-[#6D28D9]"
                              title={`Seasonal: peak ${rec.seasonality.peakLabel ?? ""}`}
                              aria-label={`Seasonal: peak ${rec.seasonality.peakLabel ?? ""}`}
                            />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(rec.quantityAvailable)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                        {formatSuggestedQty(rec.suggestedQtyRounded)}
                      </TableCell>
                      <TableCell
                        className="max-w-[160px] truncate"
                        title={rec.supplierExternalId ?? undefined}
                      >
                        <span className="inline-flex max-w-full items-center gap-1.5">
                          <span className="truncate">
                            {resolveSupplierDisplayName(
                              rec.supplierName,
                              rec.supplierExternalId
                            )}
                          </span>
                          {rec.openPoQty > 0 ? (
                            <span
                              className="shrink-0 rounded-full bg-[#EFF6FF] px-1.5 text-[10px] font-medium text-[#1D4ED8]"
                              title={rec.openPoRefs
                                .map(
                                  (ref) =>
                                    `${ref.poNumber} (${ref.status.replace(/_/g, " ")})`
                                )
                                .join(", ")}
                            >
                              On PO: {formatNumber(rec.openPoQty)}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <CoverBadge rec={rec} />
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
      </div>

      {showNoDemandItems && sortedNoDemandRows.length > 0 ? (
        <div className="space-y-3">
          <p className="px-1 text-sm text-[var(--color-text-secondary)]">
            No demand in last 13 months. May be slow-moving, seasonal, or
            discontinued.
          </p>
          <Card className="rounded-2xl p-0">
            <Table containerClassName="rounded-2xl border-0 !overflow-visible">
              <TableHeader className="bg-[#F9FAFB] [&_th]:sticky [&_th]:top-[5.125rem] [&_th]:z-20 [&_th]:bg-[#F9FAFB]">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Select</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="max-w-[180px]">Product Name</TableHead>
                  <TableHead className="text-right">Qty Available</TableHead>
                  <TableHead className="text-right">Suggested Qty</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Months of Cover</TableHead>
                  <TableHead className="w-10 text-right">
                    <span className="sr-only">Expand</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedNoDemandRows.map((rec) => {
                  const key = rowKey(rec);
                  const isExpanded = expandedSkus.has(key);
                  const seasonalityProfile = seasonalityBySku[rec.sku] ?? null;
                  const mutedClassName = "text-[var(--color-text-secondary)]";

                  return (
                    <Fragment key={`no-demand-${key}`}>
                      <TableRow
                        className={`cursor-pointer [&>td]:py-2 ${mutedClassName} ${
                          isExpanded ? "bg-slate-50 hover:bg-slate-50" : ""
                        }`}
                        onClick={() => toggleExpanded(key)}
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            disabled
                            aria-label={`Select ${rec.sku}`}
                            className="h-4 w-4 rounded border-slate-300 opacity-40"
                          />
                        </TableCell>
                        <TableCell className="w-32">
                          <span className="inline-flex flex-col items-start gap-1">
                            <Badge
                              variant={getStatusBadgeVariant(rec.status)}
                              className="whitespace-nowrap"
                            >
                              {getStatusLabel(rec.status)}
                            </Badge>
                            {(() => {
                              const badge = getDoNotBuyBadgeMeta(
                                rec.purchaseRule
                              );
                              return badge ? (
                                <span
                                  className={badge.className}
                                  title={badge.title}
                                >
                                  {badge.label}
                                </span>
                              ) : null;
                            })()}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold">
                          {rec.sku}
                        </TableCell>
                        <TableCell
                          className="max-w-[180px] truncate text-sm"
                          title={rec.name ?? undefined}
                        >
                          <span className="inline-flex max-w-full items-center gap-1.5">
                            <span className="truncate">{rec.name ?? "-"}</span>
                            {rec.seasonality?.isSeasonal ? (
                              <i
                                className="ti ti-calendar-stats shrink-0 text-sm text-[#6D28D9]"
                                title={`Seasonal: peak ${rec.seasonality.peakLabel ?? ""}`}
                                aria-label={`Seasonal: peak ${rec.seasonality.peakLabel ?? ""}`}
                              />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(rec.quantityAvailable)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatSuggestedQty(rec.suggestedQtyRounded)}
                        </TableCell>
                        <TableCell
                          className="max-w-[160px] truncate"
                          title={rec.supplierExternalId ?? undefined}
                        >
                          <span className="inline-flex max-w-full items-center gap-1.5">
                            <span className="truncate">
                              {resolveSupplierDisplayName(
                                rec.supplierName,
                                rec.supplierExternalId
                              )}
                            </span>
                            {rec.openPoQty > 0 ? (
                              <span
                                className="shrink-0 rounded-full bg-[#EFF6FF] px-1.5 text-[10px] font-medium text-[#1D4ED8]"
                                title={rec.openPoRefs
                                  .map(
                                    (ref) =>
                                      `${ref.poNumber} (${ref.status.replace(/_/g, " ")})`
                                  )
                                  .join(", ")}
                              >
                                On PO: {formatNumber(rec.openPoQty)}
                              </span>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>
                          <CoverBadge rec={rec} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight
                            className={`ml-auto h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={COLLAPSED_COLUMN_COUNT}
                            className="p-0"
                          >
                            <ReorderExpandedPanel
                              rec={rec}
                              pipeline={rec.pipelineBreakdown}
                              seasonalityProfile={seasonalityProfile}
                              explanation={explanationCache.get(key) ?? null}
                              isLoadingExplanation={explanationLoading.has(
                                key
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-40 -mx-2 space-y-3 rounded-2xl border border-transparent bg-white px-6 py-4 shadow-card shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {bulkOpenPoConfirmPending && bulkOpenPoAffected.length > 0 ? (
          <div
            role="status"
            className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E3A8A]"
          >
            <p className="font-medium">
              Some selected SKUs already have units on platform POs. Add
              anyway?
            </p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
              {bulkOpenPoAffected.map((rec) => {
                const primary = rec.openPoRefs[0];
                const statusLabel = primary
                  ? primary.status.replace(/_/g, " ")
                  : "";
                return (
                  <li key={rowKey(rec)}>
                    {rec.sku}: {formatNumber(rec.openPoQty)} units
                    {primary
                      ? ` on ${primary.poNumber} (${statusLabel})`
                      : ""}
                    {rec.openPoRefs.length > 1
                      ? ` +${rec.openPoRefs.length - 1} more`
                      : ""}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  void handleAddSelectedToPo();
                }}
                className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-tbc-red-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Adding to cart..." : "Add anyway"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setBulkOpenPoConfirmPending(false)}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-700">
            {selectedRows.length} item{selectedRows.length === 1 ? "" : "s"}{" "}
            selected across {vendorPoCount} supplier
            {vendorPoCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            disabled={
              isPending ||
              selectedRows.length === 0 ||
              (bulkOpenPoConfirmPending && bulkOpenPoAffected.length > 0)
            }
            onClick={() => {
              void handleAddSelectedToPo();
            }}
            className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-tbc-red-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Adding to cart..."
              : `Add selected to PO (${selectedRows.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
