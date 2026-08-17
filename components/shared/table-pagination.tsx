"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

export type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  /** Client-side page change (Reorder tabs). */
  onPageChange?: (page: number) => void;
  /** URL href for a page (Inventory). Takes precedence for rendering Links. */
  hrefForPage?: (page: number) => string;
  /** Optional trailing/leading summary (e.g. Showing 1-25 of 100). */
  summary?: ReactNode;
  className?: string;
};

type PageItem = number | "ellipsis";

/**
 * First, last, current, and +/-2 around current; ellipsis for gaps.
 * e.g. 1 ... 5 6 [7] 8 9 ... 13
 */
export function buildPaginationItems(
  currentPage: number,
  totalPages: number
): PageItem[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), total);

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = current - 2; p <= current + 2; p += 1) {
    if (p >= 1 && p <= total) {
      pages.add(p);
    }
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const page = sorted[i]!;
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (page - prev > 1) {
        items.push("ellipsis");
      }
    }
    items.push(page);
  }
  return items;
}

const navEnabledClassName =
  "rounded-2xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-card hover:bg-slate-50";

const navDisabledClassName =
  "rounded-2xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-400 shadow-card";

const pageButtonBaseClassName =
  "inline-flex min-w-[2.25rem] items-center justify-center rounded-2xl border border-transparent px-2.5 py-1.5 text-sm font-medium tabular-nums shadow-card";

function NavControl({
  label,
  ariaLabel,
  disabled,
  href,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  href?: string;
  onClick?: () => void;
}) {
  if (disabled) {
    return <span className={navDisabledClassName}>{label}</span>;
  }

  if (href) {
    return (
      <Link href={href} className={navEnabledClassName} aria-label={ariaLabel}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${navEnabledClassName} disabled:cursor-not-allowed disabled:opacity-50`}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}

function PageControl({
  page,
  isActive,
  href,
  onClick,
}: {
  page: number;
  isActive: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const activeClassName = `${pageButtonBaseClassName} bg-[#CC2B2B] text-white hover:bg-[#B02525]`;
  const idleClassName = `${pageButtonBaseClassName} bg-white text-slate-700 hover:bg-slate-50`;

  if (isActive) {
    return (
      <span className={activeClassName} aria-current="page" aria-label={`Page ${page}`}>
        {page}
      </span>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className={idleClassName}
        aria-label={`Page ${page}`}
      >
        {page}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={idleClassName}
      aria-label={`Page ${page}`}
    >
      {page}
    </button>
  );
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  hrefForPage,
  summary,
  className = "",
}: TablePaginationProps) {
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal);
  const pageItems = useMemo(
    () => buildPaginationItems(safeCurrent, safeTotal),
    [safeCurrent, safeTotal]
  );

  const atFirst = safeCurrent <= 1;
  const atLast = safeCurrent >= safeTotal;
  const useLinks = typeof hrefForPage === "function";

  return (
    <div
      className={`flex flex-col items-end gap-2 border-t border-slate-100 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${className}`.trim()}
    >
      {summary ? (
        <div className="w-full text-sm text-slate-500 sm:w-auto">{summary}</div>
      ) : (
        <div className="hidden sm:block" />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <NavControl
          label="First"
          ariaLabel="First page"
          disabled={atFirst}
          href={useLinks ? hrefForPage(1) : undefined}
          onClick={
            !useLinks && onPageChange ? () => onPageChange(1) : undefined
          }
        />
        <NavControl
          label="Previous"
          ariaLabel="Previous page"
          disabled={atFirst}
          href={useLinks ? hrefForPage(Math.max(1, safeCurrent - 1)) : undefined}
          onClick={
            !useLinks && onPageChange
              ? () => onPageChange(Math.max(1, safeCurrent - 1))
              : undefined
          }
        />

        <p className="px-1 text-sm tabular-nums text-slate-700">
          Page {safeCurrent} of {safeTotal}
        </p>

        <div className="flex flex-wrap items-center gap-1">
          {pageItems.map((item, index) => {
            if (item === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-sm text-slate-400"
                  aria-hidden="true"
                >
                  ...
                </span>
              );
            }

            return (
              <PageControl
                key={item}
                page={item}
                isActive={item === safeCurrent}
                href={useLinks ? hrefForPage(item) : undefined}
                onClick={
                  !useLinks && onPageChange
                    ? () => onPageChange(item)
                    : undefined
                }
              />
            );
          })}
        </div>

        <NavControl
          label="Next"
          ariaLabel="Next page"
          disabled={atLast}
          href={
            useLinks ? hrefForPage(Math.min(safeTotal, safeCurrent + 1)) : undefined
          }
          onClick={
            !useLinks && onPageChange
              ? () => onPageChange(Math.min(safeTotal, safeCurrent + 1))
              : undefined
          }
        />
        <NavControl
          label="Last"
          ariaLabel="Last page"
          disabled={atLast}
          href={useLinks ? hrefForPage(safeTotal) : undefined}
          onClick={
            !useLinks && onPageChange
              ? () => onPageChange(safeTotal)
              : undefined
          }
        />
      </div>
    </div>
  );
}
