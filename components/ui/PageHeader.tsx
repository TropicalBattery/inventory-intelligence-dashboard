import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  if (!description && !actions) {
    return <span className="sr-only">{title}</span>;
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
      <div className="min-w-0 flex-1">
        <span className="sr-only">{title}</span>
        {description ? (
          <p className="text-sm leading-relaxed text-[#6B7280]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
