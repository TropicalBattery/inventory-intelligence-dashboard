"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
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
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import type {
  InventoryItem,
  InventoryLocationBalance,
  InventoryStats,
} from "@/lib/queries/inventory";
import type { ReorderStatus } from "@/lib/types";

type InventoryTableProps = {
  items: InventoryItem[];
  locationsBySku: Record<string, InventoryLocationBalance[]>;
  page: number;
  pageSize: number;
  totalCount: number;
  showInactive: boolean;
  inactiveHiddenCount: number;
  stats: InventoryStats;
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

function formatClassCategory(itemClass: string | null, category: string | null): string {
  return [itemClass, category].filter(Boolean).join(" / ");
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

export function InventoryTable({
  items,
  locationsBySku,
  page,
  pageSize,
  totalCount,
  showInactive,
  inactiveHiddenCount,
  stats,
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

    const rows = items.filter((item) => {
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
  }, [items, searchQuery, statusFilter, classFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const cataloguePageStart =
    totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const cataloguePageEnd = Math.min(page * pageSize, totalCount);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setClassFilter("all");
  }

  if (totalCount === 0) {
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
      {!showInactive && inactiveHiddenCount > 0 ? (
        <div className="flex justify-end">
          <Badge variant="neutral">
            {formatNumber(inactiveHiddenCount)} inactive items hidden
          </Badge>
        </div>
      ) : null}

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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-transparent shadow-card bg-white px-4 py-3 text-sm text-slate-600">
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

      <Card className="overflow-hidden p-0">
        {totalCount > 0 ? (
          <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
            Showing {formatNumber(cataloguePageStart)}-{formatNumber(cataloguePageEnd)} of{" "}
            {formatNumber(totalCount)} items
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
              <Table
                containerClassName="w-max min-w-full rounded-none border-0 shadow-none !overflow-visible"
                className="min-w-[1180px]"
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[132px] px-5">SKU</TableHead>
                    <TableHead className="min-w-[200px] px-5">Product Name</TableHead>
                    <TableHead className="min-w-[160px] px-5">
                      Class / Category
                    </TableHead>
                    <TableHead className="w-[108px] px-5 text-right">
                      Qty Available
                    </TableHead>
                    <TableHead className="w-[108px] px-5 text-right">
                      Qty On Hand
                    </TableHead>
                    <TableHead className="w-[108px] px-5 text-right">
                      Qty On Order
                    </TableHead>
                    <TableHead className="w-[108px] px-5 text-right">
                      Reorder Level
                    </TableHead>
                    <TableHead className="w-[120px] px-5 text-right">
                      Max Stock Level
                    </TableHead>
                    <TableHead className="w-[128px] px-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(({ recommendation }) => {
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
                          className="cursor-pointer [&>td]:py-2.5"
                          onClick={() =>
                            setExpandedSku((current) =>
                              current === recommendation.sku
                                ? null
                                : recommendation.sku
                            )
                          }
                        >
                          <TableCell className="px-5 font-mono text-sm font-semibold text-slate-900">
                            {recommendation.sku}
                          </TableCell>
                          <TableCell
                            className="max-w-[280px] px-5"
                            title={recommendation.name ?? undefined}
                          >
                            <span className="line-clamp-1">
                              {recommendation.name ?? "-"}
                            </span>
                          </TableCell>
                          <TableCell
                            className="max-w-[220px] truncate px-5 text-slate-700"
                            title={classCategory || undefined}
                          >
                            {classCategory || "-"}
                          </TableCell>
                          <TableCell
                            className={`px-5 text-right tabular-nums ${
                              availableIsZero
                                ? "font-semibold text-red-600"
                                : "text-slate-900"
                            }`}
                          >
                            {formatNumber(recommendation.quantityAvailable)}
                          </TableCell>
                          <TableCell className="px-5 text-right tabular-nums text-slate-900">
                            {formatNumber(recommendation.quantityOnHand)}
                          </TableCell>
                          <TableCell className="px-5 text-right tabular-nums text-slate-900">
                            {formatNumber(recommendation.quantityOnOrder)}
                          </TableCell>
                          <TableCell className="px-5 text-right tabular-nums text-slate-700">
                            {recommendation.reorderLevel !== null
                              ? formatNumber(recommendation.reorderLevel)
                              : "-"}
                          </TableCell>
                          <TableCell className="px-5 text-right tabular-nums text-slate-700">
                            {recommendation.maximumStockLevel !== null
                              ? formatNumber(recommendation.maximumStockLevel)
                              : "-"}
                          </TableCell>
                          <TableCell className="px-5">
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
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">
                  Page {formatNumber(page)} of {formatNumber(totalPages)}
                </p>
                <div className="flex gap-2">
                {isFirstPage ? (
                  <span className="rounded-2xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-400 shadow-card">
                    Previous
                  </span>
                ) : (
                  <Link
                    href={inventoryPageHref(page - 1, showInactive)}
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
                    href={inventoryPageHref(page + 1, showInactive)}
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
