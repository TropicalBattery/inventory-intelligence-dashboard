"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppToastAction = {
  label: string;
  onClick: () => void;
};

export type AppToastInput = {
  message: string;
  /** Optional text button (e.g. View cart). Informational — not an error. */
  action?: AppToastAction;
  /** Auto-dismiss ms. Default 4000. */
  durationMs?: number;
};

type AppToastState = AppToastInput & { id: number };

type AppToastContextValue = {
  showToast: (toast: AppToastInput) => void;
};

const AppToastContext = createContext<AppToastContextValue | null>(null);

export function useAppToast(): AppToastContextValue {
  const value = useContext(AppToastContext);
  if (!value) {
    throw new Error("useAppToast must be used within AppToastProvider");
  }
  return value;
}

/**
 * Lightweight ephemeral toast host. The app had no toast library — this is a
 * zero-dependency stand-in matching TBC neutrals (not an error banner).
 */
export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<AppToastState | null>(null);

  const showToast = useCallback((input: AppToastInput) => {
    setToast({
      id: Date.now(),
      message: input.message,
      action: input.action,
      durationMs: input.durationMs ?? 4000,
    });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, toast.durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <AppToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[80] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#111111] shadow-card">
            <p className="min-w-0 flex-1">{toast.message}</p>
            {toast.action ? (
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-tbc-red transition-colors hover:bg-[#FDF2F2]"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
              onClick={() => setToast(null)}
            >
              <i className="ti ti-x text-base" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </AppToastContext.Provider>
  );
}
