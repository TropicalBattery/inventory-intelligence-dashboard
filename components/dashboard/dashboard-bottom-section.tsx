import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatCurrencyUSD } from "@/lib/format";
import type { PurchaseOrderListItem, ReorderRecommendation } from "@/lib/types";

type DashboardBottomSectionProps = {
  recentOrders: PurchaseOrderListItem[];
  criticalItems: ReorderRecommendation[];
};

function getPoStatusBadgeVariant(
  status: string
): "neutral" | "warning" | "success" {
  const normalized = status.trim().toLowerCase();

  if (normalized === "pending_approval" || normalized.includes("pending")) {
    return "warning";
  }

  if (normalized === "approved" || normalized.includes("confirm")) {
    return "success";
  }

  return "neutral";
}

function formatPoStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Date-only for the Recent POs table (e.g. 31 Jul 2026). */
function formatPoDateOnly(value: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DashboardBottomSection({
  recentOrders,
  criticalItems,
}: DashboardBottomSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">
          Recent Purchase Orders
        </h2>
        <Table containerClassName="shadow-none">
          <TableHeader>
            <TableRow>
              <TableHead className="w-44 whitespace-nowrap">PO Number</TableHead>
              <TableHead className="min-w-0">Supplier</TableHead>
              <TableHead className="w-28 whitespace-nowrap">Date</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Status</TableHead>
              <TableHead className="w-24 whitespace-nowrap text-right">
                Amount
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-[#6B7280]">
                  No purchase orders yet
                </TableCell>
              </TableRow>
            ) : (
              recentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="w-44 whitespace-nowrap font-mono text-sm font-medium tabular-nums">
                    {order.poNumber}
                  </TableCell>
                  <TableCell
                    className="min-w-0 max-w-[10rem] truncate"
                    title={order.supplierName ?? undefined}
                  >
                    {order.supplierName ?? "Unknown supplier"}
                  </TableCell>
                  <TableCell className="w-28 whitespace-nowrap tabular-nums">
                    {formatPoDateOnly(order.poDate)}
                  </TableCell>
                  <TableCell className="w-36 whitespace-nowrap">
                    <Badge
                      variant={getPoStatusBadgeVariant(order.status)}
                      className="whitespace-nowrap"
                    >
                      {formatPoStatus(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-24 text-right tabular-nums">
                    {formatCurrencyUSD(order.totalAmount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-[#111111]">
          Items Needing Attention
        </h2>
        <ul className="divide-y divide-[#F3F4F6]">
          {criticalItems.length === 0 ? (
            <li className="py-3 text-sm text-[#6B7280]">
              No critical items right now
            </li>
          ) : (
            criticalItems.map((item) => (
              <li
                key={item.sku}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-tbc-red-light px-2 py-0.5 font-mono text-xs font-medium text-tbc-red">
                      {item.sku}
                    </span>
                    <span className="truncate text-sm text-[#111111]">
                      {item.name ?? "Unknown product"}
                    </span>
                  </div>
                </div>
                <Badge variant="danger">Critical</Badge>
              </li>
            ))
          )}
        </ul>
        <div className="mt-4 text-right">
          <Link
            href="/reorder"
            className="text-sm font-medium text-tbc-red transition-colors hover:text-tbc-red-hover"
          >
            View all in Reorder →
          </Link>
        </div>
      </div>
    </div>
  );
}
