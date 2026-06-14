"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { navItems } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

type SidebarProps = {
  userEmail: string;
};

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
          {navItems.map((item) => {
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

      <div className="mt-auto flex w-full items-center justify-between border-t border-[#1F1F1F] px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="max-w-[140px] truncate text-xs font-medium text-[#E5E5E5]">
            {userEmail}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title="Sign out"
          aria-label="Sign out"
          className="cursor-pointer rounded-lg p-1.5 text-[#555555] transition-all duration-150 hover:bg-[#1F1F1F] hover:text-[#CC2B2B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <i className="ti ti-logout text-base" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
