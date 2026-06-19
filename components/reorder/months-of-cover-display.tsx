import {
  computeCurrentMonthsOfCover,
  computeMonthsOfCoverAtOrderQty,
  computeProjectedMonthsOfCover,
  formatMonthsOfCoverLabel,
  formatMonthsOfCoverShort,
  getMonthsOfCoverBadgeClasses,
  getMonthsOfCoverColorTier,
  getMonthsOfCoverTextClasses,
} from "@/lib/reorder/months-of-cover";
import type { ReorderRecommendation } from "@/lib/types";

type MonthsOfCoverRec = Pick<
  ReorderRecommendation,
  | "quantityOnHand"
  | "quantityAllocated"
  | "quantityInPipeline"
  | "annualDemandUnits"
  | "avgDailyDemandUnits"
  | "suggestedQtyRounded"
>;

type MonthsOfCoverDisplayProps = {
  rec: MonthsOfCoverRec;
  projectedOrderQty?: number;
  variant?: "compact" | "prominent";
  className?: string;
};

function CoverValue({
  label,
  months,
  emphasized = false,
}: {
  label: string;
  months: number | null;
  emphasized?: boolean;
}) {
  const tier = getMonthsOfCoverColorTier(months);
  const textClass = getMonthsOfCoverTextClasses(tier);

  return (
    <div className={emphasized ? "space-y-1" : "space-y-0.5"}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
        {label}
      </p>
      <p
        className={[
          emphasized ? "text-2xl font-bold" : "text-sm font-semibold",
          textClass,
        ].join(" ")}
      >
        {formatMonthsOfCoverLabel(months)}
      </p>
    </div>
  );
}

export function CoverBadge({
  rec,
  className,
}: {
  rec: MonthsOfCoverRec;
  className?: string;
}) {
  const months = computeCurrentMonthsOfCover(rec);
  const tier = getMonthsOfCoverColorTier(months);

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        getMonthsOfCoverBadgeClasses(tier),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {formatMonthsOfCoverShort(months)}
    </span>
  );
}

export function MonthsOfCoverDisplay({
  rec,
  projectedOrderQty,
  variant = "compact",
  className,
}: MonthsOfCoverDisplayProps) {
  const currentMonths = computeCurrentMonthsOfCover(rec);
  const projectedMonths =
    projectedOrderQty === undefined
      ? computeProjectedMonthsOfCover(rec)
      : computeMonthsOfCoverAtOrderQty(rec, projectedOrderQty);

  if (variant === "prominent") {
    return (
      <div
        className={[
          "grid grid-cols-2 gap-4 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <CoverValue label="Current cover" months={currentMonths} emphasized />
        <CoverValue
          label="After suggested order"
          months={projectedMonths}
          emphasized
        />
      </div>
    );
  }

  return (
    <div className={["min-w-[8.5rem] space-y-1", className].filter(Boolean).join(" ")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
          Now
        </span>
        <span
          className={`text-sm font-semibold tabular-nums ${getMonthsOfCoverTextClasses(
            getMonthsOfCoverColorTier(currentMonths)
          )}`}
        >
          {formatMonthsOfCoverLabel(currentMonths)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
          After order
        </span>
        <span
          className={`text-sm font-semibold tabular-nums ${getMonthsOfCoverTextClasses(
            getMonthsOfCoverColorTier(projectedMonths)
          )}`}
        >
          {formatMonthsOfCoverLabel(projectedMonths)}
        </span>
      </div>
    </div>
  );
}
