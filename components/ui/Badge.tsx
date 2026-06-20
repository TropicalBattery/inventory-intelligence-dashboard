import type { HTMLAttributes } from "react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "watch"
  | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-[#F0FDF4] text-[#16A34A]",
  warning: "bg-[#FFFBEB] text-[#B45309]",
  danger: "bg-[#FDF2F2] text-[#CC2B2B]",
  info: "bg-blue-50 text-[#2563EB]",
  watch: "bg-[#E6F1FB] text-[#185FA5]",
  neutral: "bg-[#F3F4F6] text-[#6B7280]",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
