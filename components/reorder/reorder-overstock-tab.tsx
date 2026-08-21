"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoverBadge } from "@/components/reorder/months-of-cover-display";
import { SavedViewsControls } from "@/components/reorder/saved-views-controls";
import {
  ListingToolbar,
  listingControlClassName,
  listingExportButtonClassName,
  listingLabelClassName,
  listingSearchInputClassName,
} from "@/components/shared/listing-toolbar";
import { MultiSelectFilter } from "@/components/shared/multi-select-filter";
import { TablePagination } from "@/components/shared/table-pagination";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatCurrencyJMD, formatNumber } from "@/lib/format";
import {
  buildDatedExportFilename,
  exportRowsToCsv,
  exportRowsToPdf,
  type ExportColumnDef,
} from "@/lib/listing/export";
import { formatSupplierOptionLabel } from "@/lib/queries/suppliers";
import { type AbcClass } from "@/lib/reorder/abc";
import { OVERSTOCK_MONTHS } from "@/lib/reorder/cover-thresholds";
import { computeCurrentMonthsOfCover } from "@/lib/reorder/months-of-cover";
import {
  getOverstockMetrics,
  selectOverstockRecommendations,
  summarizeOverstock,
} from "@/lib/reorder/overstock";
import {
  DEFAULT_OVERSTOCK_VIEW_FILTERS,
  type OverstockSortDirection,
  type OverstockSortKey,
  type OverstockViewFilters,
  overstockViewFiltersEqual,
  parseOverstockViewFilters,
} from "@/lib/reorder/overstock-view-filters";
import { isPeakApproaching } from "@/lib/reorder/seasonality";
import type { ReorderRecommendation } from "@/lib/types";

const PAGE_SIZE = 25;

const ABC_CHIP_BASE =
  "inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold";

const ABC_CHIP_TONE: Record<Exclude<AbcClass, null>, string> = {
  A: "bg-[#111111] text-white",
  B: "bg-[#6B7280] text-white",
  C: "bg-[#E5E7EB] text-[#6B7280]",
};

const ABC_CLASS_FILTER_OPTIONS: {
  value: Exclude<AbcClass, null>;
  label: string;
}[] = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

function AbcChip({ abcClass }: { abcClass: Exclude<AbcClass, null> }) {
  return (
    <span className={`${ABC_CHIP_BASE} ${ABC_CHIP_TONE[abcClass]}`}>
      {abcClass}
    </span>
  );
}

function defaultSortDirectionForKey(
  sortKey: OverstockSortKey
): OverstockSortDirection {
  return sortKey === "sku" ? "asc" : "desc";
}

function compareNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: OverstockSortDirection
): number {
  const leftMissing = left === null || left === undefined || !Number.isFinite(left);
  const rightMissing =
    right === null || right === undefined || !Number.isFinite(right);

  if (leftMissing && rightMissing) {
    return 0;
  }
  if (leftMissing) {
    return 1;
  }
  if (rightMissing) {
    return -1;
  }

  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function sortOverstockRows(
  rows: ReorderRecommendation[],
  sortKey: OverstockSortKey,
  sortDirection: OverstockSortDirection
): ReorderRecommendation[] {
  return [...rows].sort((left, right) => {
    let result = 0;

    if (sortKey === "sku") {
      result = left.sku.localeCompare(right.sku);
      return sortDirection === "asc" ? result : -result;
    }

    const leftMetrics = getOverstockMetrics(left);
    const rightMetrics = getOverstockMetrics(right);

    if (sortKey === "excessValue") {
      result = compareNullableNumber(
        leftMetrics?.excessValue,
        rightMetrics?.excessValue,
        sortDirection
      );
    } else if (sortKey === "excessUnits") {
      result = compareNullableNumber(
        leftMetrics?.excessUnits,
        rightMetrics?.excessUnits,
        sortDirection
      );
    } else {
      const leftCover =
        leftMetrics?.monthsOfCover ?? computeCurrentMonthsOfCover(left);
      const rightCover =
        rightMetrics?.monthsOfCover ?? computeCurrentMonthsOfCover(right);
      result = compareNullableNumber(leftCover, rightCover, sortDirection);
    }

    if (result !== 0) {
      return result;
    }

    return left.sku.localeCompare(right.sku);
  });
}

type OverstockExportRow = {
  sku: string;
  name: string;
  abc: string;
  qtyAvailable: string;
  monthsOfCover: string;
  excessUnits: string;
  excessValue: string;
};

const OVERSTOCK_EXPORT_COLUMNS: ExportColumnDef<OverstockExportRow>[] = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Name" },
  { key: "abc", header: "ABC" },
  { key: "qtyAvailable", header: "Qty Available", align: "right" },
  { key: "monthsOfCover", header: "Months of Cover", align: "right" },
  { key: "excessUnits", header: "Excess Units", align: "right" },
  { key: "excessValue", header: "Excess Value J$", align: "right" },
];

function buildOverstockExportRows(
  rows: ReorderRecommendation[]
): OverstockExportRow[] {
  return rows.map((rec) => {
    const metrics = getOverstockMetrics(rec);
    const monthsOfCover =
      metrics?.monthsOfCover ?? computeCurrentMonthsOfCover(rec);

    return {
      sku: rec.sku,
      name: rec.name?.trim() || "-",
      abc: rec.abcClass ?? "-",
      qtyAvailable: formatNumber(rec.quantityAvailable),
      monthsOfCover:
        monthsOfCover === null || !Number.isFinite(monthsOfCover)
          ? "-"
          : formatNumber(monthsOfCover),
      excessUnits: metrics
        ? formatNumber(Math.round(metrics.excessUnits))
        : "-",
      excessValue: formatCurrencyJMD(metrics?.excessValue ?? null),
    };
  });
}

function suggestOverstockViewName(filters: OverstockViewFilters): string {
  const parts: string[] = [];

  if (filters.abcClassFilter.length > 0) {
    parts.push(filters.abcClassFilter.join("+"));
  }
  if (filters.supplierFilter.length > 0) {
    parts.push(filters.supplierFilter.join("+"));
  }
  if (filters.peakApproachingOnly) {
    parts.push("peak approaching");
  }

  if (parts.length === 0) {
    return "All overstock";
  }

  return parts.join(" · ");
}

type ReorderOverstockTabProps = {
  recommendations: ReorderRecommendation[];
};

export function ReorderOverstockTab({
  recommendations,
}: ReorderOverstockTabProps) {
  const [viewFilters, setViewFilters] = useState<OverstockViewFilters>(() => ({
    ...DEFAULT_OVERSTOCK_VIEW_FILTERS,
    abcClassFilter: [...DEFAULT_OVERSTOCK_VIEW_FILTERS.abcClassFilter],
    supplierFilter: [...DEFAULT_OVERSTOCK_VIEW_FILTERS.supplierFilter],
  }));
  const [currentPage, setCurrentPage] = useState(1);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<"csv" | "pdf" | null>(null);

  const overstockRows = useMemo(
    () => selectOverstockRecommendations(recommendations),
    [recommendations]
  );

  const supplierOptions = useMemo(() => {
    const byId = new Map<string, string | null>();
    for (const rec of overstockRows) {
      const id = rec.supplierExternalId?.trim();
      if (!id) {
        continue;
      }
      if (!byId.has(id)) {
        byId.set(id, rec.supplierName);
      }
    }

    return Array.from(byId.entries())
      .map(([externalId, name]) => ({
        value: externalId,
        label: formatSupplierOptionLabel(name, externalId),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [overstockRows]);

  const filteredRows = useMemo(() => {
    const query = viewFilters.searchQuery.trim().toLowerCase();
    const abcSet =
      viewFilters.abcClassFilter.length > 0
        ? new Set(viewFilters.abcClassFilter)
        : null;
    const supplierSet =
      viewFilters.supplierFilter.length > 0
        ? new Set(viewFilters.supplierFilter)
        : null;

    return overstockRows.filter((rec) => {
      if (abcSet && (!rec.abcClass || !abcSet.has(rec.abcClass))) {
        return false;
      }

      if (supplierSet) {
        const supplierId = rec.supplierExternalId?.trim() ?? "";
        if (!supplierId || !supplierSet.has(supplierId)) {
          return false;
        }
      }

      if (viewFilters.peakApproachingOnly) {
        if (rec.seasonality == null || !isPeakApproaching(rec.seasonality)) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });
  }, [overstockRows, viewFilters]);

  const sortedRows = useMemo(
    () =>
      sortOverstockRows(
        filteredRows,
        viewFilters.sortKey,
        viewFilters.sortDirection
      ),
    [filteredRows, viewFilters.sortKey, viewFilters.sortDirection]
  );

  const summary = useMemo(() => summarizeOverstock(sortedRows), [sortedRows]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageStart =
    sortedRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, sortedRows.length);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return sortedRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    viewFilters.searchQuery,
    viewFilters.abcClassFilter,
    viewFilters.supplierFilter,
    viewFilters.peakApproachingOnly,
    viewFilters.sortKey,
    viewFilters.sortDirection,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const applyViewFilters = useCallback((next: OverstockViewFilters) => {
    setViewFilters({
      ...next,
      abcClassFilter: [...next.abcClassFilter],
      supplierFilter: [...next.supplierFilter],
    });
  }, []);

  const patchFilters = useCallback(
    (patch: Partial<OverstockViewFilters>) => {
      setViewFilters((current) => ({
        ...current,
        ...patch,
        abcClassFilter: patch.abcClassFilter
          ? [...patch.abcClassFilter]
          : current.abcClassFilter,
        supplierFilter: patch.supplierFilter
          ? [...patch.supplierFilter]
          : current.supplierFilter,
      }));
    },
    []
  );

  async function handleExport(format: "csv" | "pdf") {
    setIsExporting(format);
    setViewsError(null);
    try {
      const generatedAt = new Date();
      const exportRows = buildOverstockExportRows(sortedRows);
      const filename = buildDatedExportFilename("overstock", format, generatedAt);
      const dateLabel = generatedAt.toLocaleDateString("en-JM");

      if (format === "csv") {
        exportRowsToCsv(OVERSTOCK_EXPORT_COLUMNS, exportRows, filename);
      } else {
        await exportRowsToPdf(
          `Overstock Report - ${dateLabel}`,
          OVERSTOCK_EXPORT_COLUMNS,
          exportRows,
          filename,
          { generatedAt }
        );
      }
    } catch (error) {
      setViewsError(
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
      <div className="rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-card">
        Items holding more than {OVERSTOCK_MONTHS} months of stock at the
        current sales rate. Candidates for clearance pricing, promotions, or
        supplier returns.
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#111111]">
          {formatNumber(summary.itemCount)} overstocked items
        </span>
        <span className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#111111]">
          {formatCurrencyJMD(summary.totalExcessValue)} tied up
        </span>
        {summary.hasAbcData ? (
          <span className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#111111]">
            {formatNumber(summary.aClassCount)} are A-class items
          </span>
        ) : null}
      </div>

      <ListingToolbar
        filters={
          <>
            <MultiSelectFilter
              label="ABC class"
              options={ABC_CLASS_FILTER_OPTIONS}
              selected={viewFilters.abcClassFilter}
              onChange={(values) =>
                patchFilters({
                  abcClassFilter: values as Array<Exclude<AbcClass, null>>,
                })
              }
              placeholder="All classes"
              className="min-w-[140px]"
            />
            <MultiSelectFilter
              label="Supplier"
              options={supplierOptions}
              selected={viewFilters.supplierFilter}
              onChange={(values) => patchFilters({ supplierFilter: values })}
              placeholder="All suppliers"
              className="min-w-[180px]"
            />
            <label className="mb-0.5 inline-flex cursor-pointer items-center gap-1.5 pb-1 text-xs text-[#6B7280]">
              <input
                type="checkbox"
                checked={viewFilters.peakApproachingOnly}
                onChange={(event) =>
                  patchFilters({ peakApproachingOnly: event.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-[#E5E7EB] text-tbc-red focus:ring-tbc-red/20"
              />
              Peak approaching only
            </label>
          </>
        }
        search={
          <>
            <label htmlFor="overstock-search" className={listingLabelClassName}>
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="overstock-search"
                type="search"
                value={viewFilters.searchQuery}
                onChange={(event) =>
                  patchFilters({ searchQuery: event.target.value })
                }
                placeholder="Search SKU or name"
                className={listingSearchInputClassName}
              />
            </div>
          </>
        }
        sort={
          <div className="min-w-[180px]">
            <label htmlFor="overstock-sort" className={listingLabelClassName}>
              Sort
            </label>
            <select
              id="overstock-sort"
              value={viewFilters.sortKey}
              onChange={(event) => {
                const sortKey = event.target.value as OverstockSortKey;
                patchFilters({
                  sortKey,
                  sortDirection: defaultSortDirectionForKey(sortKey),
                });
              }}
              className={`${listingControlClassName} w-full min-w-[180px]`}
            >
              <option value="excessValue">Excess value</option>
              <option value="monthsOfCover">Months of cover</option>
              <option value="excessUnits">Excess units</option>
              <option value="sku">SKU</option>
            </select>
          </div>
        }
        actions={
          <>
            <SavedViewsControls
              page="overstock"
              filters={viewFilters}
              defaultFilters={DEFAULT_OVERSTOCK_VIEW_FILTERS}
              onApply={applyViewFilters}
              onError={setViewsError}
              parseFilters={parseOverstockViewFilters}
              filtersEqual={overstockViewFiltersEqual}
              suggestName={suggestOverstockViewName}
              defaultHint="Apply this view automatically when you open Overstock"
            />
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void handleExport("csv");
                }}
                disabled={isExporting !== null}
                className={listingExportButtonClassName}
                title="Download the currently filtered rows as CSV"
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
                title="Download a PDF of the currently filtered rows"
              >
                {isExporting === "pdf" ? "Exporting…" : "Export PDF"}
              </button>
            </div>
          </>
        }
      />

      {viewsError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {viewsError}
        </div>
      ) : null}

      <Card className="overflow-visible max-[1366px]:overflow-hidden rounded-2xl p-0">
        {sortedRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No overstocked items match your filters.
          </div>
        ) : (
          <>
            <Table
              className="max-[1366px]:!min-w-[1100px]"
              containerClassName="rounded-2xl border-0 !overflow-visible max-[1366px]:!overflow-x-auto"
            >
              <TableHeader className="sticky top-[5.125rem] max-[1366px]:top-0 z-20 bg-[#F9FAFB]">
                <TableRow className="hover:bg-transparent">
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>ABC</TableHead>
                  <TableHead className="text-right">Qty Available</TableHead>
                  <TableHead className="text-right">Months of Cover</TableHead>
                  <TableHead className="text-right">Excess Units</TableHead>
                  <TableHead className="text-right">Excess Value J$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((rec) => {
                  const metrics = getOverstockMetrics(rec);
                  const peakApproaching =
                    rec.seasonality != null &&
                    isPeakApproaching(rec.seasonality);

                  return (
                    <TableRow key={rec.sku}>
                      <TableCell className="font-mono text-sm font-semibold text-slate-900">
                        {rec.sku}
                      </TableCell>
                      <TableCell
                        className="max-w-[220px] text-sm text-slate-700"
                        title={rec.name ?? undefined}
                      >
                        <div className="truncate">{rec.name ?? "-"}</div>
                        {peakApproaching && rec.seasonality?.peakLabel ? (
                          <div className="mt-0.5 text-xs text-[#9CA3AF]">
                            Peak {rec.seasonality.peakLabel} approaching
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {rec.abcClass ? (
                          <AbcChip abcClass={rec.abcClass} />
                        ) : (
                          <span className="text-sm text-[#9CA3AF]">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(rec.quantityAvailable)}
                      </TableCell>
                      <TableCell className="text-right">
                        <CoverBadge rec={rec} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {metrics
                          ? formatNumber(Math.round(metrics.excessUnits))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                        {formatCurrencyJMD(metrics?.excessValue ?? null)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              className="border-[#E5E7EB] px-4"
              summary={
                <>
                  Showing {formatNumber(pageStart)}-{formatNumber(pageEnd)} of{" "}
                  {formatNumber(sortedRows.length)}
                </>
              }
            />
          </>
        )}
      </Card>
    </div>
  );
}
