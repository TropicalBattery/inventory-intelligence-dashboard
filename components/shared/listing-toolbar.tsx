import type { ReactNode } from "react";

export const listingLabelClassName =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]";

export const listingControlClassName =
  "h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111111] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

export const listingSearchInputClassName =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-9 pr-3 text-sm text-[#111111] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

export const listingExportButtonClassName =
  "rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60";

type ListingToolbarProps = {
  /** Left-side filter controls (multi-selects, checkboxes, etc.). */
  filters?: ReactNode;
  /** Flex-1 search control. */
  search?: ReactNode;
  /** Sort control (typically right of search). */
  sort?: ReactNode;
  /** Export buttons, saved views, toggles. */
  actions?: ReactNode;
  /** Optional meta line under the controls. */
  meta?: ReactNode;
  className?: string;
};

/**
 * Presentational listing toolbar shell. Each page owns its own filter/sort/export state.
 */
export function ListingToolbar({
  filters,
  search,
  sort,
  actions,
  meta,
  className,
}: ListingToolbarProps) {
  return (
    <div
      className={[
        "rounded-2xl border border-transparent bg-white p-4 shadow-card",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-wrap items-end gap-3">
        {filters}
        {search ? (
          <div className="min-w-[220px] max-w-md flex-1">{search}</div>
        ) : null}
        {sort}
      </div>

      {actions || meta ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-[#9CA3AF]">{meta ?? "\u00a0"}</div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
