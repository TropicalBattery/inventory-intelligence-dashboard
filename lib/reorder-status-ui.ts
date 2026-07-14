import type { BadgeVariant } from "@/components/ui/Badge";
import type { ReorderStatus } from "@/lib/types";

export function getStatusLabel(status: ReorderStatus): string {
  switch (status) {
    case "critical":
      return "Critical";
    case "watch":
      return "Watch";
    case "reorder_needed":
      return "Reorder Needed";
    case "ok":
      return "OK";
    case "no_demand":
      return "No Demand";
  }
}

export function getStatusBadgeVariant(status: ReorderStatus): BadgeVariant {
  switch (status) {
    case "critical":
      return "danger";
    case "watch":
      return "watch";
    case "reorder_needed":
      return "reorder";
    case "ok":
      return "success";
    case "no_demand":
      return "neutral";
  }
}

export function getStatusBadgeClassName(status: ReorderStatus): string {
  switch (status) {
    case "critical":
      return "border border-[#FCA5A5] bg-[#FDF2F2] text-[#CC2B2B]";
    case "watch":
      return "border border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]";
    case "reorder_needed":
      return "border border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C]";
    case "ok":
      return "border border-[#86EFAC] bg-[#F0FDF4] text-[#16A34A]";
    case "no_demand":
      return "border border-[#E5E7EB] bg-[#F3F4F6] text-[#6B7280]";
  }
}
