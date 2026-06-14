import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  href?: string;
  indicator?: ReactNode;
  iconClassName?: string;
  valueClassName?: string;
};

function StatCardContent({
  icon: Icon,
  label,
  value,
  indicator,
  iconClassName = "bg-tbc-red-light text-tbc-red",
  valueClassName = "text-3xl font-bold text-[#111111]",
}: Omit<StatCardProps, "href">) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
            {label}
          </p>
        </div>
        {indicator}
      </div>
      <div className={`mt-3 tabular-nums ${valueClassName}`}>{value}</div>
    </>
  );
}

export function StatCard({
  icon,
  label,
  value,
  href,
  indicator,
  iconClassName,
  valueClassName,
}: StatCardProps) {
  const className =
    "rounded-2xl border border-transparent bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover";

  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        <StatCardContent
          icon={icon}
          label={label}
          value={value}
          indicator={indicator}
          iconClassName={iconClassName}
          valueClassName={valueClassName}
        />
      </Link>
    );
  }

  return (
    <div className={className}>
      <StatCardContent
        icon={icon}
        label={label}
        value={value}
        indicator={indicator}
        iconClassName={iconClassName}
        valueClassName={valueClassName}
      />
    </div>
  );
}
