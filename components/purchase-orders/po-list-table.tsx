import Link from "next/link";
import { FileText } from "lucide-react";
import { PoListCard } from "@/components/purchase-orders/po-list-card";
import { PoSummaryCards } from "@/components/purchase-orders/po-summary-cards";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PurchaseOrderListItem } from "@/lib/types";

type PoListTableProps = {
  orders: PurchaseOrderListItem[];
};

export function PoListTable({ orders }: PoListTableProps) {
  return (
    <div>
      <PoSummaryCards orders={orders} />

      {orders.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={FileText}
            title="No purchase orders yet"
            description="Generate POs from the Reorder Recommendations page."
            action={
              <Link
                href="/reorder"
                className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Go to Reorder Recommendations
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <PoListCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
