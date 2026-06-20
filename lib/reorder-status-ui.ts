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
      return "warning";
    case "ok":
      return "success";
    case "no_demand":
      return "neutral";
  }
}

export function getStatusBadgeClassName(status: ReorderStatus): string {
  if (status === "watch") {
    return "bg-[#E6F1FB] text-[#185FA5]";
  }

  return "";
}
