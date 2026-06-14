import { InventoryTable } from "@/components/inventory/inventory-table";
import {
  getInventoryItems,
  getInventoryLocationBalancesBySku,
} from "@/lib/queries/inventory";

export default async function InventoryPage() {
  const [items, locationsBySku] = await Promise.all([
    getInventoryItems(),
    getInventoryLocationBalancesBySku(),
  ]);

  const locationsRecord = Object.fromEntries(locationsBySku.entries());

  return (
    <InventoryTable items={items} locationsBySku={locationsRecord} />
  );
}
