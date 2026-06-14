"use client";

import { getPageSubtitle, getPageTitle } from "@/lib/navigation";
import { usePathname } from "next/navigation";

type TopBarProps = {
  userEmail: string;
};

function getAvatarLetter(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) {
    return "?";
  }

  return trimmed.charAt(0).toUpperCase();
}

export function TopBar({ userEmail }: TopBarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const subtitle = getPageSubtitle(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-[#E5E7EB] bg-white px-8 py-4">
      <div className="flex min-h-8 items-center justify-between gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-[#111111]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-sm text-[#6B7280]">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] transition-colors duration-150 hover:bg-[#F3F4F6] hover:text-[#111111]"
            aria-label="Notifications"
          >
            <i className="ti ti-bell text-xl" aria-hidden="true" />
          </button>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-tbc-red-light text-sm font-medium text-tbc-red"
            aria-label={userEmail}
          >
            {getAvatarLetter(userEmail)}
          </div>
        </div>
      </div>
    </header>
  );
}
