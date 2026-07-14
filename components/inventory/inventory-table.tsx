"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatNumber } from "@/lib/format";
import {
  summarizeInventoryStats,
  type InventoryItem,
  type InventoryLocationBalance,
} from "@/lib/queries/inventory";
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import type { ReorderStatus } from "@/lib/types";

type InventoryTableProps = {
  items: InventoryItem[];
  locationsBySku: Record<string, InventoryLocationBalance[]>;
  page: number;
  pageSize: number;
  showInactive: boolean;
  inactiveHiddenCount: number;
  lastInventorySyncAt: string | null;
};

type StatusFilter =
  | "all"
  | "critical"
  | "watch"
  | "reorder_needed"
  | "ok"
  | "no_demand"
  | "reorder"
  | "inactive";

const filterSelectClassName =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

const STATUS_ORDER: Record<ReorderStatus, number> = {
  critical: 0,
  watch: 1,
  reorder_needed: 2,
  ok: 3,
  no_demand: 4,
};

const COLUMN_COUNT = 8;

/**
 * Sticky under the app TopBar (py-4 + title + optional subtitle + border ≈ 5.125rem).
 * Same offset as the reorder tables.
 */
const STICKY_TH_CLASS =
  "sticky top-[5.125rem] z-20 border-b border-[#E5E7EB] bg-[#F9FAFB] !whitespace-normal";

function matchesStatusFilter(
  status: ReorderStatus,
  filter: StatusFilter
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "reorder") {
    return status === "reorder_needed";
  }

  if (filter === "inactive") {
    return status === "no_demand";
  }

  return status === filter;
}

function inventoryPageHref(page: number, showInactive: boolean): string {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (showInactive) {
    params.set("inactive", "true");
  }

  const queryString = params.toString();
  return queryString ? `/inventory?${queryString}` : "/inventory";
}

function ClassCategoryCell({
  itemClass,
  category,
}: {
  itemClass: string | null;
  category: string | null;
}) {
  if (!itemClass && !category) {
    return <span className="text-[#9CA3AF]">-</span>;
  }

  const title = [itemClass, category].filter(Boolean).join(" / ");

  return (
    <div className="min-w-0 space-y-0.5" title={title}>
      {itemClass ? (
        <p className="truncate text-xs font-medium text-slate-800">
          {itemClass}
        </p>
      ) : null}
      {category ? (
        <p className="truncate text-xs text-slate-500">{category}</p>
      ) : null}
    </div>
  );
}

export function InventoryTable({
  items,
  locationsBySku,
  page,
  pageSize,
  showInactive,
  inactiveHiddenCount,
  lastInventorySyncAt,
}: InventoryTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  function handleInactiveToggle(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());

    if (checked) {
      params.set("inactive", "true");
    } else {
      params.delete("inactive");
    }

    params.set("page", "1");
    router.push(`/inventory?${params.toString()}`);
  }

  function resetToFirstPage() {
    if (page <= 1) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `/inventory?${queryString}` : "/inventory");
  }

  const classOptions = useMemo(() => {
    const values = new Set<string>();

    for (const item of items) {
      if (item.recommendation.itemClass) {
        values.add(item.recommendation.itemClass);
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [items]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  /** Inactive + status + class (search excluded) — drives the stats strip. */
  const statsRows = useMemo(() => {
    return items.filter((item) => {
      if (!showInactive && item.isInactive) {
        return false;
      }

      if (!matchesStatusFilter(item.recommendation.status, statusFilter)) {
        return false;
      }

      if (
        classFilter !== "all" &&
        item.recommendation.itemClass !== classFilter
      ) {
        return false;
      }

      return true;
    });
  }, [items, showInactive, statusFilter, classFilter]);

  const stats = useMemo(
    () => summarizeInventoryStats(statsRows),
    [statsRows]
  );

  const filteredRows = useMemo(() => {
    const rows = items.filter((item) => {
      const { recommendation } = item;

      // Empty search: respect Show inactive. Non-empty search: include inactive.
      if (!hasSearchQuery && !showInactive && item.isInactive) {
        return false;
      }

      if (!matchesStatusFilter(recommendation.status, statusFilter)) {
        return false;
      }

      if (classFilter !== "all" && recommendation.itemClass !== classFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const skuLower = recommendation.sku.toLowerCase();
      const skuMatch =
        skuLower === normalizedQuery || skuLower.includes(normalizedQuery);
      const nameMatch =
        recommendation.name?.toLowerCase().includes(normalizedQuery) ?? false;
      return skuMatch || nameMatch;
    });

    return rows.sort((left, right) => {
      if (normalizedQuery) {
        const leftExact =
          left.recommendation.sku.toLowerCase() === normalizedQuery ? 0 : 1;
        const rightExact =
          right.recommendation.sku.toLowerCase() === normalizedQuery ? 0 : 1;
        if (leftExact !== rightExact) {
          return leftExact - rightExact;
        }
      }

      const statusDiff =
        STATUS_ORDER[left.recommendation.status] -
        STATUS_ORDER[right.recommendation.status];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return left.recommendation.sku.localeCompare(right.recommendation.sku);
    });
  }, [
    items,
    hasSearchQuery,
    normalizedQuery,
    showInactive,
    statusFilter,
    classFilter,
  ]);

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStartIndex = (safePage - 1) * pageSize;
  const pageRows = filteredRows.slice(
    pageStartIndex,
    pageStartIndex + pageSize
  );
  const cataloguePageStart = totalCount === 0 ? 0 : pageStartIndex + 1;
  const cataloguePageEnd = Math.min(pageStartIndex + pageSize, totalCount);
  const isFirstPage = safePage <= 1;
  const isLastPage = safePage >= totalPages;

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) {
      resetToFirstPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages]);

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setClassFilter("all");
    resetToFirstPage();
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Package}
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
      <div className="flex flex-wrap items-center justify-end gap-3">
        {!showInactive && inactiveHiddenCount > 0 ? (
          <Badge variant="neutral">
            {formatNumber(inactiveHiddenCount)} inactive items hidden
          </Badge>
        ) : null}
        <DataFreshnessBadge lastSyncAt={lastInventorySyncAt} />
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-transparent bg-white p-4 shadow-card">
        <div className="min-w-[220px] flex-1">
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
              onChange={(event) => {
                setSearchQuery(event.target.value);
                if (page > 1) {
                  resetToFirstPage();
                }
              }}
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
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              if (page > 1) {
                resetToFirstPage();
              }
            }}
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
            onChange={(event) => {
              setClassFilter(event.target.value);
              if (page > 1) {
                resetToFirstPage();
              }
            }}
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
          <label className="flex h-10 items-center gap-2 rounded-2xl border border-transparent bg-white px-3 text-sm text-slate-700 shadow-card">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => handleInactiveToggle(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20"
            />
            Show inactive items
            {!showInactive && inactiveHiddenCount > 0 ? (
              <span className="text-xs text-slate-500">
                ({formatNumber(inactiveHiddenCount)})
              </span>
            ) : null}
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-transparent bg-white px-4 py-3 text-sm text-slate-600 shadow-card">
        <span>
          Total:{" "}
          <strong className="font-semibold text-slate-900">
            {formatNumber(stats.total)}
          </strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Critical:{" "}
          <strong className="font-semibold text-red-700">
            {formatNumber(stats.critical)}
          </strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Reorder Needed:{" "}
          <strong className="font-semibold text-amber-700">
            {formatNumber(stats.reorderNeeded)}
          </strong>
        </span>
        <span className="text-slate-300">|</span>
        <span>
          OK:{" "}
          <strong className="font-semibold text-green-700">
            {formatNumber(stats.ok)}
          </strong>
        </span>
      </div>

      <Card className="w-full max-w-full overflow-visible rounded-2xl p-0">
        {totalCount > 0 ? (
          <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
            Showing {formatNumber(cataloguePageStart)}-
            {formatNumber(cataloguePageEnd)} of {formatNumber(totalCount)} items
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
              className="rounded-2xl border border-transparent bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-card hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <Table
              containerClassName="w-full max-w-full rounded-none border-0 shadow-none !overflow-visible"
              className="table-fixed w-full"
            >
              <colgroup>
                <col className="w-32" />
                <col />
                <col className="w-40" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-28" />
              </colgroup>
              <TableHeader className="bg-[#F9FAFB]">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${STICKY_TH_CLASS} px-3`}>
                    SKU
                  </TableHead>
                  <TableHead className={`${STICKY_TH_CLASS} px-3`}>
                    Product Name
                  </TableHead>
                  <TableHead className={`${STICKY_TH_CLASS} px-3`}>
                    Class / Category
                  </TableHead>
                  <TableHead
                    className={`${STICKY_TH_CLASS} px-2 text-right`}
                  >
                    Qty Avail
                  </TableHead>
                  <TableHead
                    className={`${STICKY_TH_CLASS} px-2 text-right`}
                  >
                    On Hand
                  </TableHead>
                  <TableHead
                    className={`${STICKY_TH_CLASS} px-2 text-right`}
                  >
                    On Order
                  </TableHead>
                  <TableHead
                    className={`${STICKY_TH_CLASS} px-2 text-right`}
                  >
                    Reorder Lvl
                  </TableHead>
                  <TableHead className={`${STICKY_TH_CLASS} px-3`}>
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((item) => {
                  const { recommendation, isInactive } = item;
                  const locations = locationsBySku[recommendation.sku] ?? [];
                  const isExpanded = expandedSku === recommendation.sku;
                  const availableIsZero =
                    recommendation.quantityAvailable <= 0;

                  return (
                    <Fragment key={recommendation.sku}>
                      <TableRow
                        className="cursor-pointer [&>td]:py-2.5"
                        onClick={() =>
                          setExpandedSku((current) =>
                            current === recommendation.sku
                              ? null
                              : recommendation.sku
                          )
                        }
                      >
                        <TableCell className="px-3 align-top">
                          <div className="min-w-0 space-y-1">
                            <p className="break-words font-mono text-xs font-semibold text-slate-900">
                              {recommendation.sku}
                            </p>
                            {isInactive ? (
                              <span className="inline-block rounded-full border border-[#E5E7EB] bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                                Inactive
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell
                          className="min-w-0 px-3 align-top"
                          title={recommendation.name ?? undefined}
                        >
                          <span className="block truncate text-sm text-slate-800">
                            {recommendation.name ?? "-"}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 px-3 align-top">
                          <ClassCategoryCell
                            itemClass={recommendation.itemClass}
                            category={recommendation.category}
                          />
                        </TableCell>
                        <TableCell
                          className={`px-2 text-right align-top tabular-nums ${
                            availableIsZero
                              ? "font-semibold text-red-600"
                              : "text-slate-900"
                          }`}
                        >
                          {formatNumber(recommendation.quantityAvailable)}
                        </TableCell>
                        <TableCell className="px-2 text-right align-top tabular-nums text-slate-900">
                          {formatNumber(recommendation.quantityOnHand)}
                        </TableCell>
                        <TableCell className="px-2 text-right align-top tabular-nums text-slate-900">
                          {formatNumber(recommendation.quantityOnOrder)}
                        </TableCell>
                        <TableCell className="px-2 text-right align-top tabular-nums text-slate-700">
                          {recommendation.reorderLevel !== null
                            ? formatNumber(recommendation.reorderLevel)
                            : "-"}
                        </TableCell>
                        <TableCell className="px-3 align-top">
                          <Badge
                            variant={getStatusBadgeVariant(
                              recommendation.status
                            )}
                          >
                            {getStatusLabel(recommendation.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow
                          key={`${recommendation.sku}-details`}
                          className="bg-slate-50 hover:bg-slate-50"
                        >
                          <TableCell
                            colSpan={COLUMN_COUNT}
                            className="px-6 py-4"
                          >
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-slate-900">
                                Location breakdown
                              </p>
                              {locations.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  No per-location balances available for this
                                  SKU.
                                </p>
                              ) : (
                                <div className="overflow-x-auto rounded-2xl border border-transparent bg-white shadow-card">
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
                                            {formatNumber(
                                              location.quantityOnHand
                                            )}
                                          </td>
                                          <td className="px-4 py-2 text-right text-slate-700">
                                            {formatNumber(
                                              location.quantityAvailable
                                            )}
                                          </td>
                                          <td className="px-4 py-2 text-right text-slate-700">
                                            {formatNumber(
                                              location.quantityOnOrder
                                            )}
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

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">
                  Page {formatNumber(safePage)} of {formatNumber(totalPages)}
                </p>
                <div className="flex gap-2">
                  {isFirstPage ? (
                    <span className="rounded-2xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-400 shadow-card">
                      Previous
                    </span>
                  ) : (
                    <Link
                      href={inventoryPageHref(safePage - 1, showInactive)}
                      className="rounded-2xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-card hover:bg-slate-50"
                    >
                      Previous
                    </Link>
                  )}
                  {isLastPage ? (
                    <span className="rounded-2xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-400 shadow-card">
                      Next
                    </span>
                  ) : (
                    <Link
                      href={inventoryPageHref(safePage + 1, showInactive)}
                      className="rounded-2xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-card hover:bg-slate-50"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
