"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatNumber } from "@/lib/format";
import type { ReorderRecommendation } from "@/lib/types";

const PAGE_SIZE = 25;

const filterSelectClassName =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

const tableCellClassName = "py-2";

type SortOption = "sku-asc" | "name-asc" | "qty-desc";

type ReorderUnclassifiedTabProps = {
  recommendations: ReorderRecommendation[];
};

function isDeadStockRow(rec: ReorderRecommendation): boolean {
  return (
    rec.quantityAvailable === 0 &&
    (rec.annualDemandUnits === null ||
      rec.annualDemandUnits === undefined ||
      rec.annualDemandUnits === 0)
  );
}

function formatAnnualDemand(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return "-";
  }

  return formatNumber(value);
}

function sortRows(
  rows: ReorderRecommendation[],
  sortOption: SortOption
): ReorderRecommendation[] {
  const sorted = [...rows];

  sorted.sort((left, right) => {
    if (sortOption === "name-asc") {
      const leftName = left.name ?? "";
      const rightName = right.name ?? "";
      const nameDiff = leftName.localeCompare(rightName);
      return nameDiff !== 0 ? nameDiff : left.sku.localeCompare(right.sku);
    }

    if (sortOption === "qty-desc") {
      const qtyDiff = right.quantityAvailable - left.quantityAvailable;
      return qtyDiff !== 0 ? qtyDiff : left.sku.localeCompare(right.sku);
    }

    return left.sku.localeCompare(right.sku);
  });

  return sorted;
}

export function ReorderUnclassifiedTab({
  recommendations,
}: ReorderUnclassifiedTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sortOption, setSortOption] = useState<SortOption>("sku-asc");
  const [currentPage, setCurrentPage] = useState(1);

  const classOptions = useMemo(() => {
    const values = new Set<string>();

    for (const rec of recommendations) {
      if (rec.itemClass) {
        values.add(rec.itemClass);
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [recommendations]);

  const deadStockCount = useMemo(
    () => recommendations.filter(isDeadStockRow).length,
    [recommendations]
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const rows = recommendations.filter((rec) => {
      if (classFilter !== "all" && rec.itemClass !== classFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });

    return sortRows(rows, sortOption);
  }, [recommendations, searchQuery, classFilter, sortOption]);

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
  }, [searchQuery, classFilter, sortOption]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-transparent shadow-card bg-slate-50 px-4 py-3 text-sm text-slate-700">
        These items have unrecognised item classes and cannot be reordered.
        Share this list with your GP administrator for cleanup.
      </div>

      {deadStockCount > 0 ? (
        <p className="text-sm text-slate-500">
          {formatNumber(deadStockCount)} items have no stock and no sales
          activity
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-transparent shadow-card bg-white p-4">
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="unclassified-search"
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
              id="unclassified-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search SKU or name"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20"
            />
          </div>
        </div>

        <div className="min-w-[180px]">
          <label
            htmlFor="unclassified-class-filter"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Item Class
          </label>
          <select
            id="unclassified-class-filter"
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            className={`${filterSelectClassName} w-full min-w-[180px]`}
          >
            <option value="all">All classes</option>
            {classOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[220px]">
          <label
            htmlFor="unclassified-sort"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Sort
          </label>
          <select
            id="unclassified-sort"
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value as SortOption)}
            className={`${filterSelectClassName} w-full min-w-[220px]`}
          >
            <option value="sku-asc">SKU A-Z</option>
            <option value="name-asc">Name A-Z</option>
            <option value="qty-desc">Qty Available (high to low)</option>
          </select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {filteredRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No unclassified items match your filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table containerClassName="rounded-none border-0">
                <colgroup>
                  <col className="w-36" />
                  <col />
                  <col className="w-36" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-36" />
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={`w-36 ${tableCellClassName}`}>
                      SKU
                    </TableHead>
                    <TableHead className={tableCellClassName}>Name</TableHead>
                    <TableHead className={`w-36 ${tableCellClassName}`}>
                      Item Class
                    </TableHead>
                    <TableHead className={`w-32 ${tableCellClassName}`}>
                      Category
                    </TableHead>
                    <TableHead className={`w-28 text-right ${tableCellClassName}`}>
                      Qty Available
                    </TableHead>
                    <TableHead className={`w-36 text-right ${tableCellClassName}`}>
                      Annual Demand Units
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((rec) => (
                    <TableRow
                      key={rec.sku}
                      className={
                        isDeadStockRow(rec) ? "opacity-50 hover:bg-slate-50" : undefined
                      }
                    >
                      <TableCell
                        className={`w-36 font-mono text-sm font-medium text-slate-900 ${tableCellClassName}`}
                      >
                        {rec.sku}
                      </TableCell>
                      <TableCell
                        className={`min-w-0 ${tableCellClassName}`}
                        title={rec.name ?? undefined}
                      >
                        <span className="line-clamp-2">{rec.name ?? "-"}</span>
                      </TableCell>
                      <TableCell className={`w-36 ${tableCellClassName}`}>
                        {rec.itemClass ?? "-"}
                      </TableCell>
                      <TableCell className={`w-32 ${tableCellClassName}`}>
                        {rec.category ?? "-"}
                      </TableCell>
                      <TableCell
                        className={`w-28 text-right tabular-nums ${tableCellClassName} ${
                          rec.quantityAvailable <= 0
                            ? "font-semibold text-red-600"
                            : ""
                        }`}
                      >
                        {formatNumber(rec.quantityAvailable)}
                      </TableCell>
                      <TableCell
                        className={`w-36 text-right tabular-nums ${tableCellClassName}`}
                      >
                        {formatAnnualDemand(rec.annualDemandUnits)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col items-end gap-2 border-t border-slate-100 px-6 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-2xl border border-transparent shadow-card bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <p className="text-sm text-slate-700">
                Page {currentPage} of {formatNumber(totalPages)}
              </p>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                className="rounded-2xl border border-transparent shadow-card bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
              <p className="text-sm text-slate-500">
                Showing {formatNumber(pageStart)}-{formatNumber(pageEnd)} of{" "}
                {formatNumber(filteredRows.length)} items
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
