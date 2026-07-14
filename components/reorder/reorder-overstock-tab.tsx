"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CoverBadge } from "@/components/reorder/months-of-cover-display";
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
import { type AbcClass } from "@/lib/reorder/abc";
import { OVERSTOCK_MONTHS } from "@/lib/reorder/cover-thresholds";
import {
  getOverstockMetrics,
  selectOverstockRecommendations,
  sortOverstockByExcessValueDesc,
  summarizeOverstock,
} from "@/lib/reorder/overstock";
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

function AbcChip({ abcClass }: { abcClass: Exclude<AbcClass, null> }) {
  return (
    <span className={`${ABC_CHIP_BASE} ${ABC_CHIP_TONE[abcClass]}`}>
      {abcClass}
    </span>
  );
}

type ReorderOverstockTabProps = {
  recommendations: ReorderRecommendation[];
};

export function ReorderOverstockTab({
  recommendations,
}: ReorderOverstockTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const overstockRows = useMemo(
    () =>
      sortOverstockByExcessValueDesc(
        selectOverstockRecommendations(recommendations)
      ),
    [recommendations]
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return overstockRows;
    }

    return overstockRows.filter((rec) => {
      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });
  }, [overstockRows, searchQuery]);

  const summary = useMemo(
    () => summarizeOverstock(filteredRows),
    [filteredRows]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageStart =
    filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredRows.length);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-transparent bg-white p-4 shadow-card">
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="overstock-search"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
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
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search SKU or name"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20"
            />
          </div>
        </div>
      </div>

      <Card className="rounded-2xl p-0">
        {filteredRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No overstocked items match your filters.
          </div>
        ) : (
          <>
            <Table containerClassName="rounded-2xl border-0 !overflow-visible">
              <TableHeader className="sticky top-[5.125rem] z-20 bg-[#F9FAFB]">
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-3 text-sm text-slate-600">
              <p>
                Showing {formatNumber(pageStart)}-{formatNumber(pageEnd)} of{" "}
                {formatNumber(filteredRows.length)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
