import Link from "next/link";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export function EmptyReorderState() {
  return (
    <EmptyState
      icon={Package}
      title="No inventory data yet"
      description="Sync data from the connector to see reorder recommendations."
      action={
        <Link
          href="/connector-health"
          className="inline-flex rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-tbc-red-hover"
        >
          Check Connector Health
        </Link>
      }
    />
  );
}
