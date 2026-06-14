import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

type TableProps = HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string;
};

export function Table({
  className = "",
  containerClassName = "",
  children,
  ...props
}: TableProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-transparent bg-white shadow-card ${containerClassName}`.trim()}
    >
      <table
        className={`w-full min-w-full border-collapse text-sm ${className}`.trim()}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-[#F9FAFB] ${className}`.trim()} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  className = "divide-y divide-[#F3F4F6]",
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transition-colors hover:bg-[#F9FAFB] ${className}`.trim()}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className = "",
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest whitespace-nowrap text-[#6B7280] ${className}`.trim()}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className = "",
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-[#111111] ${className}`.trim()} {...props}>
      {children}
    </td>
  );
}
