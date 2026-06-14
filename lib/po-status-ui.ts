import type { BadgeVariant } from "@/components/ui/Badge";

/**
 * PO status badge mapping:
 * - draft -> neutral (slate)
 * - sent -> success (green), chosen over info so a completed send reads as a positive terminal state
 */
export function getPoStatusBadgeVariant(status: string): BadgeVariant {
  if (status === "sent") {
    return "success";
  }

  return "neutral";
}

export function getPoStatusLabel(status: string): string {
  if (status === "sent") {
    return "Sent";
  }

  if (status === "draft") {
    return "Draft";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}
