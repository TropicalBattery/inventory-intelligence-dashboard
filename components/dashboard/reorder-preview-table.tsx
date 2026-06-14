import Link from "next/link";
import { PackageCheck } from "lucide-react";
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
import { formatNumber } from "@/lib/format";
import type { ReorderPreviewItem } from "@/lib/types/database";

type ReorderPreviewTableProps = {
  items: ReorderPreviewItem[];
};

export function ReorderPreviewTable({ items }: ReorderPreviewTableProps) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Top 5 Items Needing Reorder
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Items with the largest shortfall below reorder level.
          </p>
        </div>
        <Link
          href="/reorder"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="All items are well stocked"
          description="No items are currently below their reorder level."
        />
      ) : (
        <Table containerClassName="rounded-none border-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Qty available</TableHead>
              <TableHead className="text-right">Reorder level</TableHead>
              <TableHead className="text-right">Shortfall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.sku}>
                <TableCell className="font-medium text-slate-900">
                  {item.sku}
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(item.quantityAvailable)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(item.reorderLevel)}
                </TableCell>
                <TableCell className="text-right font-medium text-red-700">
                  {formatNumber(item.shortfall)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
