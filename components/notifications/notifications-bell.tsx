"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatRelativeTimeShort } from "@/lib/format";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications?: NotificationItem[];
  unreadCount?: number;
  error?: string;
};

const POLL_MS = 60_000;

export function NotificationsBell() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      const data = (await response.json().catch(() => null)) as
        | NotificationsResponse
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load notifications");
      }

      setNotifications(data?.notifications ?? []);
      setUnreadCount(
        typeof data?.unreadCount === "number" &&
          Number.isFinite(data.unreadCount)
          ? data.unreadCount
          : 0
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, pathname]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadNotifications();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  async function handleOpenToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setIsLoading(true);
      await loadNotifications();
      setIsLoading(false);
    }
  }

  async function handleMarkRead(item: NotificationItem) {
    if (!item.readAt) {
      try {
        await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, {
          method: "PATCH",
        });
        setNotifications((current) =>
          current.map((row) =>
            row.id === item.id
              ? { ...row, readAt: row.readAt ?? new Date().toISOString() }
              : row
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (err) {
        console.error(err);
      }
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((current) =>
        current.map((row) => ({
          ...row,
          readAt: row.readAt ?? new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  }

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          void handleOpenToggle();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] transition-colors duration-150 hover:bg-[#F3F4F6] hover:text-[#111111]"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <i className="ti ti-bell text-xl" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#CC2B2B] px-1 text-[10px] text-white">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
            <p className="text-sm font-semibold text-[#111111]">
              Notifications
            </p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  void handleMarkAllRead();
                }}
                className="text-xs font-medium text-[#CC2B2B] hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
                Loading…
              </p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-[#CC2B2B]">
                {error}
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
                No notifications yet
              </p>
            ) : (
              <ul>
                {notifications.map((item) => {
                  const unread = !item.readAt;
                  const content = (
                    <div className="px-4 py-3 hover:bg-[#F9FAFB]">
                      <p
                        className={`text-sm text-[#111111] ${
                          unread ? "font-semibold" : "font-normal"
                        }`}
                      >
                        {item.title}
                      </p>
                      {item.body ? (
                        <p className="mt-0.5 text-xs text-[#6B7280]">
                          {item.body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-[#9CA3AF]">
                        {formatRelativeTimeShort(item.createdAt)}
                      </p>
                    </div>
                  );

                  return (
                    <li key={item.id} className="border-b border-[#F3F4F6]">
                      {item.link ? (
                        <Link
                          href={item.link}
                          onClick={() => {
                            void handleMarkRead(item);
                          }}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            void handleMarkRead(item);
                          }}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
