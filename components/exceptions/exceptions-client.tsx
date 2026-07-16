"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  ListingToolbar,
  listingControlClassName,
  listingExportButtonClassName,
  listingLabelClassName,
  listingSearchInputClassName,
} from "@/components/shared/listing-toolbar";
import {
  EXCEPTION_LABELS,
  type ExceptionType,
  type SkuExceptionGroup,
} from "@/lib/exceptions/detect";
import { formatNumber } from "@/lib/format";
import {
  buildDatedExportFilename,
  exportRowsToCsv,
  type ExportColumnDef,
} from "@/lib/listing/export";

const PAGE_SIZE = 25;

const TYPE_ORDER: ExceptionType[] = [
  "negative_stock",
  "missing_supplier_data",
  "stale_demand",
  "conflicting_rules",
];

type ExceptionsSortKey = "severity" | "sku";

type ExceptionExportRow = {
  sku: string;
  name: string;
  exceptionTypes: string;
  detail: string;
};

const EXCEPTION_EXPORT_COLUMNS: ExportColumnDef<ExceptionExportRow>[] = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Name" },
  { key: "exceptionTypes", header: "Exception Types" },
  { key: "detail", header: "Detail" },
];

const PILL_STYLES: Record<
  ExceptionType,
  { active: string; idle: string; badge: "danger" | "warning" | "neutral" }
> = {
  negative_stock: {
    active: "border-[#FCA5A5] bg-[#FDF2F2] text-[#CC2B2B]",
    idle: "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#FCA5A5]",
    badge: "danger",
  },
  missing_supplier_data: {
    active: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
    idle: "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#FDE68A]",
    badge: "warning",
  },
  stale_demand: {
    active: "border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]",
    idle: "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]",
    badge: "neutral",
  },
  conflicting_rules: {
    active: "border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]",
    idle: "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]",
    badge: "neutral",
  },
};

type ExceptionsClientProps = {
  groups: SkuExceptionGroup[];
};

function countForType(
  groups: SkuExceptionGroup[],
  type: ExceptionType
): number {
  return groups.reduce(
    (sum, group) =>
      sum + (group.exceptions.some((e) => e.type === type) ? 1 : 0),
    0
  );
}

function actionForTypes(types: ExceptionType[]): ReactNode {
  if (types.includes("missing_supplier_data")) {
    return (
      <Link
        href="/reference-data"
        className="text-sm font-medium text-tbc-red hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        Add pricing
      </Link>
    );
  }
  if (types.includes("conflicting_rules")) {
    return <span className="text-sm text-[#9CA3AF]">Client review</span>;
  }
  return <span className="text-sm text-[#9CA3AF]">-</span>;
}

function mostSevereTypeIndex(group: SkuExceptionGroup): number {
  let best = TYPE_ORDER.length;
  for (const exception of group.exceptions) {
    const index = TYPE_ORDER.indexOf(exception.type);
    if (index !== -1 && index < best) {
      best = index;
    }
  }
  return best;
}

function compareSku(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function buildExceptionExportRows(
  groups: SkuExceptionGroup[]
): ExceptionExportRow[] {
  return groups.map((group) => ({
    sku: group.sku,
    name: group.name?.trim() || "-",
    exceptionTypes: group.exceptions
      .map((exception) => EXCEPTION_LABELS[exception.type])
      .join("; "),
    detail: group.exceptions.map((exception) => exception.detail).join("; "),
  }));
}

export function ExceptionsClient({ groups }: ExceptionsClientProps) {
  const [activeTypes, setActiveTypes] = useState<Set<ExceptionType>>(
    () => new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<ExceptionsSortKey>("severity");
  const [page, setPage] = useState(1);

  const typeCounts = useMemo(() => {
    const counts = {} as Record<ExceptionType, number>;
    for (const type of TYPE_ORDER) {
      counts[type] = countForType(groups, type);
    }
    return counts;
  }, [groups]);

  const filteredSorted = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let next = groups;

    if (activeTypes.size > 0) {
      next = next.filter((group) =>
        group.exceptions.some((exception) => activeTypes.has(exception.type))
      );
    }

    if (query.length > 0) {
      next = next.filter((group) => {
        const sku = group.sku.toLowerCase();
        const name = (group.name ?? "").toLowerCase();
        return sku.includes(query) || name.includes(query);
      });
    }

    const sorted = [...next];
    sorted.sort((a, b) => {
      if (sortKey === "severity") {
        const severityDiff =
          mostSevereTypeIndex(a) - mostSevereTypeIndex(b);
        if (severityDiff !== 0) {
          return severityDiff;
        }
      }
      return compareSku(a.sku, b.sku);
    });

    return sorted;
  }, [groups, activeTypes, searchQuery, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredSorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function toggleType(type: ExceptionType) {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    setPage(1);
  }

  function handleExportCsv() {
    const filename = buildDatedExportFilename("exceptions", "csv");
    exportRowsToCsv(
      EXCEPTION_EXPORT_COLUMNS,
      buildExceptionExportRows(filteredSorted),
      filename
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TYPE_ORDER.map((type) => {
          const selected = activeTypes.has(type);
          const styles = PILL_STYLES[type];
          const count = typeCounts[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selected ? styles.active : styles.idle
              }`}
            >
              {formatNumber(count)} {EXCEPTION_LABELS[type]}
            </button>
          );
        })}
      </div>

      <ListingToolbar
        search={
          <>
            <label htmlFor="exceptions-search" className={listingLabelClassName}>
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="exceptions-search"
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search SKU or name"
                className={listingSearchInputClassName}
              />
            </div>
          </>
        }
        sort={
          <div className="min-w-[180px]">
            <label htmlFor="exceptions-sort" className={listingLabelClassName}>
              Sort
            </label>
            <select
              id="exceptions-sort"
              value={sortKey}
              onChange={(event) => {
                setSortKey(event.target.value as ExceptionsSortKey);
                setPage(1);
              }}
              className={`${listingControlClassName} w-full min-w-[180px]`}
            >
              <option value="severity">Severity</option>
              <option value="sku">SKU</option>
            </select>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredSorted.length === 0}
            className={listingExportButtonClassName}
            title="Download the currently filtered rows as CSV"
          >
            Export CSV
          </button>
        }
      />

      <Card className="w-full overflow-visible rounded-2xl p-0">
        {filteredSorted.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[#6B7280]">
            {groups.length === 0
              ? "All clear — no data exceptions detected."
              : "No exceptions match the selected filters."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                    <th className="w-[28%] px-4 py-3">SKU / Product</th>
                    <th className="w-[22%] px-4 py-3">Exception</th>
                    <th className="w-[35%] px-4 py-3">Detail</th>
                    <th className="w-[15%] px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((group) => {
                    const types = group.exceptions.map((e) => e.type);
                    return (
                      <tr
                        key={group.sku}
                        className="border-b border-[#F3F4F6] last:border-b-0"
                      >
                        <td className="px-4 py-3 align-top">
                          <p className="font-mono text-xs font-semibold text-[#111111]">
                            {group.sku}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-[#6B7280]">
                            {group.name ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1">
                            {group.exceptions.map((exception) => (
                              <Badge
                                key={exception.type}
                                variant={PILL_STYLES[exception.type].badge}
                              >
                                {EXCEPTION_LABELS[exception.type]}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-[#374151]">
                          <ul className="space-y-1">
                            {group.exceptions.map((exception) => (
                              <li key={`${group.sku}-${exception.type}`}>
                                {exception.detail}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {actionForTypes(types)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] px-4 py-3">
              <p className="text-sm text-[#6B7280]">
                Showing{" "}
                {formatNumber((safePage - 1) * PAGE_SIZE + 1)}-
                {formatNumber(
                  Math.min(safePage * PAGE_SIZE, filteredSorted.length)
                )}{" "}
                of {formatNumber(filteredSorted.length)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#111111] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#111111] disabled:cursor-not-allowed disabled:opacity-40"
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
