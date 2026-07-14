"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReorderActionTab } from "@/components/reorder/reorder-action-tab";
import { ReorderNonStockTab } from "@/components/reorder/reorder-non-stock-tab";
import { ReorderOverstockTab } from "@/components/reorder/reorder-overstock-tab";
import { ReorderTabBar } from "@/components/reorder/reorder-tab-bar";
import { ReorderUnclassifiedTab } from "@/components/reorder/reorder-unclassified-tab";
import { EmptyReorderState } from "@/components/reorder/reorder-utils";
import { Card } from "@/components/ui/Card";
import {
  buildReorderTabCounts,
  countReorderTabAttention,
  parseReorderPageTab,
  selectWhitelistedReorderAction,
  type ClassifiedReorderRecommendations,
  type ReorderPageTab,
} from "@/lib/reorder-tab-classification";
import type {
  VelocityDiagnostic,
  VwSalesVelocityRow,
} from "@/lib/types";
import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";
import type { SupplierFilterOption } from "@/lib/queries/suppliers";

type ReorderRecommendationsProps = {
  classified: ClassifiedReorderRecommendations;
  diagnosticsBySku: Record<string, VelocityDiagnostic>;
  velocityBySku: Record<string, VwSalesVelocityRow>;
  seasonalityBySku: Record<string, ItemSeasonalityProfile>;
  lastInventorySyncAt: string | null;
  activeInventorySkuCount?: number | null;
  supplierFilterOptions?: SupplierFilterOption[];
};

export function ReorderRecommendations({
  classified,
  diagnosticsBySku,
  velocityBySku,
  seasonalityBySku,
  lastInventorySyncAt,
  activeInventorySkuCount = null,
  supplierFilterOptions = [],
}: ReorderRecommendationsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseReorderPageTab(searchParams.get("tab"));

  const whitelistedReorderAction = useMemo(
    () => selectWhitelistedReorderAction(classified.reorderAction),
    [classified.reorderAction]
  );

  const [reorderAttentionCount, setReorderAttentionCount] = useState(() =>
    countReorderTabAttention(whitelistedReorderAction)
  );

  const tabCounts = useMemo(
    () => buildReorderTabCounts(classified),
    [classified]
  );

  const totalItems =
    classified.reorderAction.length +
    classified.nonStock.length +
    classified.unclassified.length;

  const handleTabChange = useCallback(
    (tab: ReorderPageTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const handleAttentionCountChange = useCallback((count: number) => {
    setReorderAttentionCount(count);
  }, []);

  if (totalItems === 0) {
    return <EmptyReorderState />;
  }

  return (
    <div className="space-y-6 pb-8">
      <Card className="rounded-2xl p-0">
        <ReorderTabBar
          activeTab={activeTab}
          reorderAttentionCount={reorderAttentionCount}
          overstockCount={tabCounts.overstockTotal}
          nonStockCount={tabCounts.nonStockTotal}
          unclassifiedCount={tabCounts.unclassifiedTotal}
          lastInventorySyncAt={lastInventorySyncAt}
          onTabChange={handleTabChange}
        />

        <div className="p-4 sm:p-6">
          {activeTab === "reorder" ? (
            <ReorderActionTab
              recommendations={whitelistedReorderAction}
              diagnosticsBySku={diagnosticsBySku}
              seasonalityBySku={seasonalityBySku}
              onAttentionCountChange={handleAttentionCountChange}
              activeInventorySkuCount={activeInventorySkuCount}
              supplierFilterOptions={supplierFilterOptions}
            />
          ) : null}

          {activeTab === "overstock" ? (
            <ReorderOverstockTab recommendations={whitelistedReorderAction} />
          ) : null}

          {activeTab === "nonstock" ? (
            <ReorderNonStockTab
              recommendations={classified.nonStock}
              velocityBySku={velocityBySku}
            />
          ) : null}

          {activeTab === "unclassified" ? (
            <ReorderUnclassifiedTab recommendations={classified.unclassified} />
          ) : null}
        </div>
      </Card>
    </div>
  );
}
