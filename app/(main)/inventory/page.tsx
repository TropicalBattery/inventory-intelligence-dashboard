import { InventoryTable } from "@/components/inventory/inventory-table";
import {
  getInventoryInactiveHiddenCount,
  getInventoryItemCount,
  getInventoryItems,
  getInventoryLocationBalancesBySku,
  getInventoryStats,
  INVENTORY_PAGE_SIZE,
} from "@/lib/queries/inventory";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { page?: string; inactive?: string };
}) {
  const parsedPage = parseInt(searchParams.page ?? "1", 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const showInactive = searchParams.inactive === "true";

  const [items, totalCount, stats, inactiveHiddenCount] = await Promise.all([
    getInventoryItems(page, showInactive),
    getInventoryItemCount(showInactive),
    getInventoryStats(showInactive),
    getInventoryInactiveHiddenCount(),
  ]);

  const skus = items.map((item) => item.recommendation.sku);
  const locationsBySku = await getInventoryLocationBalancesBySku(skus);
  const locationsRecord = Object.fromEntries(locationsBySku.entries());

  return (
    <InventoryTable
      items={items}
      locationsBySku={locationsRecord}
      page={page}
      pageSize={INVENTORY_PAGE_SIZE}
      totalCount={totalCount}
      showInactive={showInactive}
      inactiveHiddenCount={inactiveHiddenCount}
      stats={stats}
    />
  );
}
