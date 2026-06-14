"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatNumber } from "@/lib/format";
import {
  countInactiveRecommendations,
} from "@/lib/reorder-filters";
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import type {
  InventoryItem,
  InventoryLocationBalance,
} from "@/lib/queries/inventory";
import type { ReorderStatus } from "@/lib/types";

type InventoryTableProps = {
  items: InventoryItem[];
  locationsBySku: Record<string, InventoryLocationBalance[]>;
};

type StatusFilter = "all" | "critical" | "reorder" | "ok" | "inactive";

const PAGE_SIZE = 50;

const filterSelectClassName =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

const STATUS_ORDER: Record<ReorderStatus, number> = {
  critical: 0,
  reorder: 1,
  ok: 2,
  inactive: 3,
};

function matchesStatusFilter(
  status: ReorderStatus,
  filter: StatusFilter
): boolean {
  if (filter === "all") {
    return true;
  }

  return status === filter;
}

function formatClassCategory(itemClass: string | null, category: string | null): string {
  return [itemClass, category].filter(Boolean).join(" / ");
}

export function InventoryTable({ items, locationsBySku }: InventoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [showInactiveItems, setShowInactiveItems] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const inactiveCount = useMemo(
    () => countInactiveRecommendations(items.map((item) => item.recommendation)),
    [items]
  );

  const visibleItems = useMemo(() => {
    if (showInactiveItems) {
      return items;
    }

    return items.filter((item) => item.recommendation.status !== "inactive");
  }, [items, showInactiveItems]);

  const classOptions = useMemo(() => {
    const values = new Set<string>();

    for (const item of items) {
      if (item.recommendation.itemClass) {
        values.add(item.recommendation.itemClass);
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [items]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const rows = visibleItems.filter((item) => {
      const { recommendation } = item;

      if (!matchesStatusFilter(recommendation.status, statusFilter)) {
        return false;
      }

      if (classFilter !== "all" && recommendation.itemClass !== classFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skuMatch = recommendation.sku.toLowerCase().includes(query);
      const nameMatch = recommendation.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });

    return rows.sort((left, right) => {
      const statusDiff =
        STATUS_ORDER[left.recommendation.status] -
        STATUS_ORDER[right.recommendation.status];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return left.recommendation.sku.localeCompare(right.recommendation.sku);
    });
  }, [visibleItems, searchQuery, statusFilter, classFilter]);

  const summaryCounts = useMemo(() => {
    return filteredRows.reduce(
      (counts, item) => {
        const status = item.recommendation.status;
        if (status === "critical") {
          counts.critical += 1;
        } else if (status === "reorder") {
          counts.reorder += 1;
        } else if (status === "ok") {
          counts.ok += 1;
        }
        return counts;
      },
      { critical: 0, reorder: 0, ok: 0 }
    );
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredRows.length);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, classFilter, showInactiveItems]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setClassFilter("all");
    setShowInactiveItems(false);
    setCurrentPage(1);
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState          icon={Package}
          title="No inventory data yet"
          description="Sync data from the connector to see current stock levels."
          action={
            <Link
              href="/connector-health"
              className="inline-flex rounded-lg bg-tbc-red px-4 py-2 text-sm font-medium text-white hover:bg-tbc-red-hover"
            >
              Check Connector Health
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!showInactiveItems && inactiveCount > 0 ? (
        <div className="flex justify-end">
          <Badge variant="neutral">
            {inactiveCount} inactive items hidden
          </Badge>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-transparent shadow-card bg-white p-4">        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="inventory-search"
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
              id="inventory-search"
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
            htmlFor="inventory-status-filter"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Status
          </label>
          <select
            id="inventory-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            className={`${filterSelectClassName} w-full min-w-[180px]`}
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="reorder">Reorder Needed</option>
            <option value="ok">OK</option>
            <option value="inactive">No Activity</option>
          </select>
        </div>

        <div className="min-w-[180px]">
          <label
            htmlFor="inventory-class-filter"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Class / Category
          </label>
          <select
            id="inventory-class-filter"
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
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Inactive items
          </label>
          <label className="flex h-10 items-center gap-2 rounded-2xl border border-transparent shadow-card bg-white px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showInactiveItems}
              onChange={(event) => setShowInactiveItems(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20"
            />
            Show inactive items
            {inactiveCount > 0 ? (
              <span className="text-xs text-slate-500">({inactiveCount})</span>
            ) : null}
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-transparent shadow-card bg-white px-4 py-3 text-sm text-slate-600">
        <span>
          Total: <strong className="font-semibold text-slate-900">{formatNumber(filteredRows.length)}</strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Critical:{" "}
          <strong className="font-semibold text-red-700">
            {formatNumber(summaryCounts.critical)}
          </strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Reorder Needed:{" "}
          <strong className="font-semibold text-amber-700">
            {formatNumber(summaryCounts.reorder)}
          </strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          OK:{" "}
          <strong className="font-semibold text-green-700">
            {formatNumber(summaryCounts.ok)}
          </strong>
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        {filteredRows.length > 0 ? (
          <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
            Showing {formatNumber(pageStart)}-{formatNumber(pageEnd)} of{" "}
            {formatNumber(filteredRows.length)} items
          </p>
        ) : null}

        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <p className="text-sm text-slate-600">
              No items match the current filters.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-2xl border border-transparent shadow-card bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table containerClassName="rounded-none border-0">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[120px] px-5">SKU</TableHead>
                    <TableHead className="min-w-[220px] px-5">Product Name</TableHead>
                    <TableHead className="min-w-[140px] px-5">Category / Class</TableHead>
                    <TableHead className="min-w-[110px] px-5 text-right">
                      Qty Available
                    </TableHead>
                    <TableHead className="min-w-[110px] px-5 text-right">
                      Qty On Hand
                    </TableHead>
                    <TableHead className="min-w-[110px] px-5 text-right">
                      Qty On Order
                    </TableHead>
                    <TableHead className="min-w-[110px] px-5 text-right">
                      Reorder Level
                    </TableHead>
                    <TableHead className="min-w-[120px] px-5 text-right">
                      Max Stock Level
                    </TableHead>
                    <TableHead className="min-w-[130px] px-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map(({ recommendation }) => {
                    const classCategory = formatClassCategory(
                      recommendation.itemClass,
                      recommendation.category
                    );
                    const locations = locationsBySku[recommendation.sku] ?? [];
                    const isExpanded = expandedSku === recommendation.sku;
                    const availableIsZero = recommendation.quantityAvailable <= 0;

                    return (
                      <Fragment key={recommendation.sku}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedSku((current) =>
                              current === recommendation.sku
                                ? null
                                : recommendation.sku
                            )
                          }
                        >
                          <TableCell className="px-5 py-3.5 font-mono text-sm font-semibold text-slate-900">
                            {recommendation.sku}
                          </TableCell>
                          <TableCell
                            className="max-w-xs px-5 py-3.5"
                            title={recommendation.name ?? undefined}
                          >
                            <span className="line-clamp-2">
                              {recommendation.name ?? "-"}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-5 py-3.5">
                            {classCategory || "-"}
                          </TableCell>
                          <TableCell
                            className={`px-5 py-3.5 text-right tabular-nums ${
                              availableIsZero ? "font-semibold text-red-600" : ""
                            }`}
                          >
                            {formatNumber(recommendation.quantityAvailable)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right tabular-nums">
                            {formatNumber(recommendation.quantityOnHand)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right tabular-nums">
                            {formatNumber(recommendation.quantityOnOrder)}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right tabular-nums">
                            {recommendation.reorderLevel !== null
                              ? formatNumber(recommendation.reorderLevel)
                              : "-"}
                          </TableCell>
                          <TableCell className="px-5 py-3.5 text-right tabular-nums">
                            {recommendation.maximumStockLevel !== null
                              ? formatNumber(recommendation.maximumStockLevel)
                              : "-"}
                          </TableCell>
                          <TableCell className="px-5 py-3.5">
                            <Badge variant={getStatusBadgeVariant(recommendation.status)}>
                              {getStatusLabel(recommendation.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded ? (
                          <TableRow
                            key={`${recommendation.sku}-details`}
                            className="bg-slate-50 hover:bg-slate-50"
                          >
                            <TableCell colSpan={9} className="px-6 py-4">
                              <div className="space-y-3">
                                <p className="text-sm font-medium text-slate-900">
                                  Location breakdown
                                </p>
                                {locations.length === 0 ? (
                                  <p className="text-sm text-slate-500">
                                    No per-location balances available for this SKU.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto rounded-2xl border border-transparent shadow-card bg-white">
                                    <table className="min-w-full text-sm">
                                      <thead className="bg-slate-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Location
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                                            On hand
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                                            Available
                                          </th>
                                          <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                                            On order
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {locations.map((location, index) => (
                                          <tr
                                            key={`${recommendation.sku}-${location.locationCode ?? index}`}
                                            className="border-t border-slate-100"
                                          >
                                            <td className="px-4 py-2 text-slate-700">
                                              {location.locationName ??
                                                location.locationCode ??
                                                "Unknown location"}
                                            </td>
                                            <td className="px-4 py-2 text-right text-slate-700">
                                              {formatNumber(location.quantityOnHand)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-slate-700">
                                              {formatNumber(location.quantityAvailable)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-slate-700">
                                              {formatNumber(location.quantityOnOrder)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Page {currentPage} of {formatNumber(totalPages)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded-2xl border border-transparent shadow-card bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
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
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
