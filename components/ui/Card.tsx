import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-transparent bg-white p-6 shadow-card ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
