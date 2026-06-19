import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";
import { getSeasonalReorderWarning } from "@/lib/seasonality/reorder-warnings";

type SeasonalWarningBadgeProps = {
  profile: ItemSeasonalityProfile | null | undefined;
  compact?: boolean;
};

export function SeasonalWarningBadge({
  profile,
  compact = false,
}: SeasonalWarningBadgeProps) {
  const warning = getSeasonalReorderWarning(profile);

  if (!warning) {
    return null;
  }

  const className =
    warning.kind === "peak_now"
      ? "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
      : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 font-medium",
        compact ? "text-[10px]" : "text-xs",
        className,
      ].join(" ")}
    >
      {warning.message}
    </span>
  );
}
