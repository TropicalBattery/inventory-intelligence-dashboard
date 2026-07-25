import { formatNumber } from "@/lib/format";
import { formatPackChip, type PackInfo } from "@/lib/format/uom";

/**
 * Shared UOM cell for reorder + inventory tables.
 * Pack ratio → "12/cs"; named unit → lowercased label; else muted "ea".
 */
export function UomCell({ pack }: { pack: PackInfo }) {
  if (pack.unitsPerCase != null) {
    return (
      <span
        className="font-semibold text-[#374151]"
        title={`${formatNumber(pack.unitsPerCase)} units per case`}
      >
        {formatPackChip(pack.unitsPerCase)}
      </span>
    );
  }

  if (pack.label && pack.label !== "ea") {
    return <span className="text-[#374151]">{pack.label}</span>;
  }

  return <span className="text-[#9CA3AF]">ea</span>;
}
