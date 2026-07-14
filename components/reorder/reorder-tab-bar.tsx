"use client";

import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import type { ReorderPageTab } from "@/lib/reorder-tab-classification";
import { formatNumber } from "@/lib/format";

type ReorderTabBarProps = {
  activeTab: ReorderPageTab;
  reorderAttentionCount: number;
  overstockCount: number;
  nonStockCount: number;
  unclassifiedCount: number;
  lastInventorySyncAt: string | null;
  onTabChange: (tab: ReorderPageTab) => void;
};

const tabButtonClassName = (isActive: boolean) =>
  [
    "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
    isActive
      ? "border-tbc-red text-tbc-red"
      : "border-transparent text-[#6B7280] hover:text-[#111111]",
  ].join(" ");

export function ReorderTabBar({
  activeTab,
  reorderAttentionCount,
  overstockCount,
  nonStockCount,
  unclassifiedCount,
  lastInventorySyncAt,
  onTabChange,
}: ReorderTabBarProps) {
  return (
    <div className="border-b border-[#E5E7EB] bg-white px-2 pt-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={tabButtonClassName(activeTab === "reorder")}
            onClick={() => onTabChange("reorder")}
          >
            Reorder Action
            {reorderAttentionCount > 0 ? (
              <span className="ml-2 text-xs font-normal text-[#6B7280]">
                ({formatNumber(reorderAttentionCount)} need attention)
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={tabButtonClassName(activeTab === "overstock")}
            onClick={() => onTabChange("overstock")}
          >
            Overstock ({formatNumber(overstockCount)})
          </button>
          <button
            type="button"
            className={tabButtonClassName(activeTab === "nonstock")}
            onClick={() => onTabChange("nonstock")}
          >
            Non-Stock Items ({formatNumber(nonStockCount)})
          </button>
          <button
            type="button"
            className={tabButtonClassName(activeTab === "unclassified")}
            onClick={() => onTabChange("unclassified")}
          >
            Unclassified ({formatNumber(unclassifiedCount)})
          </button>
        </div>

        <div className="shrink-0 px-2 pb-2 sm:pb-0">
          <DataFreshnessBadge lastSyncAt={lastInventorySyncAt} />
        </div>
      </div>
    </div>
  );
}
