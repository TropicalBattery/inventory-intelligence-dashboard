import { InventoryTable } from "@/components/inventory/inventory-table";
import { getLastSuccessfulInventoryBalancesSyncAt } from "@/lib/connector/health";
import { getRecentSyncRuns } from "@/lib/queries/connector-health";
import {
  getAllInventoryItems,
  getInventoryInactiveHiddenCount,
  getInventoryLocationBalancesBySku,
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

  const [items, syncRuns] = await Promise.all([
    getAllInventoryItems(),
    getRecentSyncRuns(),
  ]);

  const inactiveHiddenCount = await getInventoryInactiveHiddenCount(items);
  const locationsBySku = await getInventoryLocationBalancesBySku();
  const locationsRecord = Object.fromEntries(locationsBySku.entries());
  const lastInventorySyncAt =
    getLastSuccessfulInventoryBalancesSyncAt(syncRuns);

  return (
    <InventoryTable
      items={items}
      locationsBySku={locationsRecord}
      page={page}
      pageSize={INVENTORY_PAGE_SIZE}
      showInactive={showInactive}
      inactiveHiddenCount={inactiveHiddenCount}
      lastInventorySyncAt={lastInventorySyncAt}
    />
  );
}
