import Link from "next/link";
import { FileText } from "lucide-react";
import {
  PoListRowActions,
  PoListStatusBadge,
} from "@/components/purchase-orders/po-list-row-actions";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatCurrencyJMD, formatDateTime } from "@/lib/format";
import type { PurchaseOrderListItem } from "@/lib/types";

type PoListTableProps = {
  orders: PurchaseOrderListItem[];
};

export function PoListTable({ orders }: PoListTableProps) {
  if (orders.length === 0) {
    return (
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
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-slate-50">
          <TableHead>PO number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium text-slate-900">
              {order.poNumber}
            </TableCell>
            <TableCell>{order.supplierName ?? "-"}</TableCell>
            <TableCell>
              {order.poDate ? formatDateTime(order.poDate) : "-"}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrencyJMD(order.totalAmount)}
            </TableCell>
            <TableCell>
              <PoListStatusBadge status={order.status} />
            </TableCell>
            <TableCell>
              <PoListRowActions order={order} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
