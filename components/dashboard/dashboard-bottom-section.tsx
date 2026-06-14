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
import { formatCurrencyJMD, formatDateTime } from "@/lib/format";
import type { PurchaseOrderListItem, ReorderRecommendation } from "@/lib/types";

type DashboardBottomSectionProps = {
  recentOrders: PurchaseOrderListItem[];
  criticalItems: ReorderRecommendation[];
};

function getPoStatusBadgeVariant(
  status: string
): "neutral" | "info" | "success" {
  const normalized = status.toLowerCase();

  if (normalized.includes("draft")) {
    return "neutral";
  }

  if (normalized.includes("sent")) {
    return "info";
  }

  if (normalized.includes("confirm")) {
    return "success";
  }

  return "neutral";
}

function formatPoStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
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
                  <TableCell className="font-medium">{order.poNumber}</TableCell>
                  <TableCell>{order.supplierName ?? "Unknown supplier"}</TableCell>
                  <TableCell>{formatDateTime(order.poDate)}</TableCell>
                  <TableCell>
                    <Badge variant={getPoStatusBadgeVariant(order.status)}>
                      {formatPoStatus(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrencyJMD(order.totalAmount)}
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
