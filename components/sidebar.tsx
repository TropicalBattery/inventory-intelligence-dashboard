"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AccountPopover } from "@/components/account-popover";
import type { UserRole } from "@/lib/auth/role-guards";
import { navItems } from "@/lib/navigation";

type SidebarProps = {
  userEmail: string;
  userRole: UserRole;
};

export function Sidebar({ userEmail, userRole }: SidebarProps) {
  const pathname = usePathname();

  const visibleNavItems = useMemo(
    () =>
      navItems.filter(
        (item) => !item.approverOnly || userRole === "approver"
      ),
    [userRole]
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-tbc-sidebar text-tbc-sidebar-text">
      <div className="flex h-16 shrink-0 items-center justify-center px-4">
        <Link href="/dashboard" className="flex items-center justify-center">
          <Image
            src="/tb_logo.png"
            alt="Tropical Battery Company"
            width={220}
            height={48}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <p className="mb-2 mt-6 px-4 text-xs uppercase tracking-widest text-[#555555]">
          Navigation
        </p>
        <div className="space-y-1">
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-150 ${
                  isActive
                    ? "mx-2 bg-tbc-sidebar-active text-white"
                    : "mx-2 text-tbc-sidebar-text hover:bg-tbc-sidebar-hover"
                }`}
              >
                <i
                  className={`ti ${item.iconClass} shrink-0 text-[20px] ${
                    isActive ? "text-white" : "text-tbc-sidebar-icon"
                  }`}
                  aria-hidden="true"
                />
                <span className={isActive ? "text-white" : "text-tbc-sidebar-text"}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-[#1F1F1F] px-3 py-3">
        <AccountPopover userEmail={userEmail} userRole={userRole} />
      </div>
    </aside>
  );
}
