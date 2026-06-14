import type { BadgeVariant } from "@/components/ui/Badge";
import type { ReorderStatus } from "@/lib/types";

export function getStatusLabel(status: ReorderStatus): string {
  switch (status) {
    case "critical":
      return "Critical";
    case "reorder":
      return "Reorder Needed";
    case "ok":
      return "OK";
    case "inactive":
      return "No Activity";
  }
}

export function getStatusBadgeVariant(status: ReorderStatus): BadgeVariant {
  switch (status) {
    case "critical":
      return "danger";
    case "reorder":
      return "warning";
    case "ok":
      return "success";
    case "inactive":
      return "neutral";
  }
}
