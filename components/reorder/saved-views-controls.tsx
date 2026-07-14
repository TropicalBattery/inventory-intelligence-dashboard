"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  DEFAULT_REORDER_ACTION_VIEW_FILTERS,
  REORDER_ACTION_VIEW_PAGE,
  normalizeViewName,
  reorderActionViewFiltersEqual,
  type ReorderActionViewFilters,
} from "@/lib/reorder/view-filters";
import type { SavedViewRecord } from "@/lib/saved-views/store";

type SavedViewsControlsProps = {
  filters: ReorderActionViewFilters;
  onApply: (filters: ReorderActionViewFilters) => void;
  onError: (message: string | null) => void;
};

const buttonClassName =
  "rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60";

function suggestedViewName(
  filters: ReorderActionViewFilters,
  selectedView: SavedViewRecord | null,
  matchesSelected: boolean
): string {
  if (selectedView && matchesSelected) {
    return selectedView.name;
  }
  if (filters.supplierFilter !== "all") {
    return `${filters.statusFilter} · ${filters.supplierFilter}`;
  }
  return `${filters.statusFilter} view`;
}

export function SavedViewsControls({
  filters,
  onApply,
  onError,
}: SavedViewsControlsProps) {
  const [views, setViews] = useState<SavedViewRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [appliedDefault, setAppliedDefault] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveModalError, setSaveModalError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const selectedView = useMemo(
    () => views.find((view) => view.id === selectedId) ?? null,
    [selectedId, views]
  );

  const matchesSelected =
    selectedView != null &&
    reorderActionViewFiltersEqual(filters, selectedView.filters);

  const loadViews = useCallback(async (): Promise<SavedViewRecord[]> => {
    const response = await fetch(
      `/api/saved-views?page=${encodeURIComponent(REORDER_ACTION_VIEW_PAGE)}`
    );
    const payload = (await response.json()) as {
      views?: SavedViewRecord[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load saved views");
    }
    return payload.views ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextViews = await loadViews();
        if (cancelled) {
          return;
        }
        setViews(nextViews);

        if (!appliedDefault) {
          const defaultView = nextViews.find((view) => view.isDefault);
          if (defaultView) {
            setSelectedId(defaultView.id);
            onApply(defaultView.filters);
          }
          setAppliedDefault(true);
        }
      } catch (error) {
        if (!cancelled) {
          onError(
            error instanceof Error
              ? error.message
              : "Failed to load saved views"
          );
          setAppliedDefault(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally once on mount for default apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!saveOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveInputRef.current?.focus();
      saveInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [saveOpen]);

  async function refreshViews(preferId?: string | null) {
    const nextViews = await loadViews();
    setViews(nextViews);
    if (preferId && nextViews.some((view) => view.id === preferId)) {
      setSelectedId(preferId);
      return;
    }
    if (selectedId && !nextViews.some((view) => view.id === selectedId)) {
      setSelectedId("");
    }
  }

  async function handleSelect(nextId: string) {
    setSelectedId(nextId);
    onError(null);

    if (!nextId) {
      onApply({ ...DEFAULT_REORDER_ACTION_VIEW_FILTERS });
      return;
    }

    const view = views.find((entry) => entry.id === nextId);
    if (view) {
      onApply(view.filters);
    }
  }

  function openSaveModal() {
    setSaveName(suggestedViewName(filters, selectedView, matchesSelected));
    setSaveModalError(null);
    onError(null);
    setSaveOpen(true);
  }

  function closeSaveModal() {
    if (isBusy) {
      return;
    }
    setSaveOpen(false);
    setSaveModalError(null);
  }

  async function submitSaveView() {
    const name = normalizeViewName(saveName);
    if (!name) {
      setSaveModalError("Enter a view name (max 80 characters).");
      return;
    }

    setIsBusy(true);
    setSaveModalError(null);
    onError(null);
    try {
      const response = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: REORDER_ACTION_VIEW_PAGE,
          name,
          filters,
          isDefault: false,
        }),
      });
      const payload = (await response.json()) as {
        view?: SavedViewRecord;
        error?: string;
      };
      if (!response.ok || !payload.view) {
        throw new Error(payload.error ?? "Failed to save view");
      }
      await refreshViews(payload.view.id);
      setSaveOpen(false);
    } catch (error) {
      setSaveModalError(
        error instanceof Error ? error.message : "Failed to save view"
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUpdate() {
    if (!selectedView) {
      return;
    }

    setIsBusy(true);
    onError(null);
    try {
      const response = await fetch(`/api/saved-views/${selectedView.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });
      const payload = (await response.json()) as {
        view?: SavedViewRecord;
        error?: string;
      };
      if (!response.ok || !payload.view) {
        throw new Error(payload.error ?? "Failed to update view");
      }
      await refreshViews(payload.view.id);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to update view"
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSetDefault() {
    if (!selectedView) {
      return;
    }

    setIsBusy(true);
    onError(null);
    try {
      const response = await fetch(`/api/saved-views/${selectedView.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const payload = (await response.json()) as {
        view?: SavedViewRecord;
        error?: string;
      };
      if (!response.ok || !payload.view) {
        throw new Error(payload.error ?? "Failed to set default view");
      }
      await refreshViews(payload.view.id);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to set default view"
      );
    } finally {
      setIsBusy(false);
    }
  }

  function openDeleteModal() {
    if (!selectedView) {
      return;
    }
    onError(null);
    setDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (isBusy) {
      return;
    }
    setDeleteOpen(false);
  }

  async function confirmDelete() {
    if (!selectedView) {
      return;
    }

    setIsBusy(true);
    onError(null);
    try {
      const response = await fetch(`/api/saved-views/${selectedView.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete view");
      }
      setSelectedId("");
      setDeleteOpen(false);
      await refreshViews(null);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to delete view"
      );
      setDeleteOpen(false);
    } finally {
      setIsBusy(false);
    }
  }

  const disabled = isLoading || isBusy;

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor="saved-view-select">
          Saved view
        </label>
        <select
          id="saved-view-select"
          value={selectedId}
          disabled={disabled}
          onChange={(event) => {
            void handleSelect(event.target.value);
          }}
          className="h-7 max-w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs text-[#374151] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20 disabled:opacity-60"
          title="Saved filter views for this user"
        >
          <option value="">Built-in default</option>
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.isDefault ? `★ ${view.name}` : view.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={buttonClassName}
          disabled={disabled}
          onClick={openSaveModal}
          title="Save the current filters as a named view"
        >
          Save view
        </button>
        {selectedView && !matchesSelected ? (
          <button
            type="button"
            className={buttonClassName}
            disabled={disabled}
            onClick={() => {
              void handleUpdate();
            }}
            title="Overwrite this saved view with the current filters"
          >
            Update
          </button>
        ) : null}
        {selectedView && !selectedView.isDefault ? (
          <button
            type="button"
            className={buttonClassName}
            disabled={disabled}
            onClick={() => {
              void handleSetDefault();
            }}
            title="Apply this view automatically when you open Reorder Action"
          >
            Set default
          </button>
        ) : null}
        {selectedView ? (
          <button
            type="button"
            className={buttonClassName}
            disabled={disabled}
            onClick={openDeleteModal}
            title="Delete this saved view"
          >
            Delete
          </button>
        ) : null}
      </div>

      <Modal
        open={saveOpen}
        onClose={closeSaveModal}
        ariaLabelledBy="save-view-title"
        className="max-w-md"
      >
        <h3
          id="save-view-title"
          className="text-lg font-semibold text-[#111111]"
        >
          Save current filters
        </h3>
        <p className="mt-1 text-sm text-[#6B7280]">
          Name this view so you can restore these filters later.
        </p>
        <label
          htmlFor="save-view-name"
          className="mt-4 mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]"
        >
          View name
        </label>
        <input
          ref={saveInputRef}
          id="save-view-name"
          type="text"
          value={saveName}
          maxLength={80}
          disabled={isBusy}
          onChange={(event) => {
            setSaveName(event.target.value);
            if (saveModalError) {
              setSaveModalError(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submitSaveView();
            }
          }}
          className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#111111] focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20 disabled:opacity-60"
          placeholder="e.g. Hankook Critical"
        />
        {saveModalError ? (
          <p className="mt-2 text-sm text-[#CC2B2B]" role="alert">
            {saveModalError}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeSaveModal}
            disabled={isBusy}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void submitSaveView();
            }}
            disabled={isBusy}
            className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white hover:bg-[#B02626] disabled:opacity-60"
          >
            {isBusy ? "Saving…" : "Save view"}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteModal}
        ariaLabelledBy="delete-view-title"
        className="max-w-md"
      >
        <h3
          id="delete-view-title"
          className="text-lg font-semibold text-[#111111]"
        >
          Delete saved view?
        </h3>
        <p className="mt-2 text-sm text-[#6B7280]">
          {selectedView
            ? `“${selectedView.name}” will be removed. This cannot be undone.`
            : "This view will be removed. This cannot be undone."}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={isBusy}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void confirmDelete();
            }}
            disabled={isBusy}
            className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white hover:bg-[#B02626] disabled:opacity-60"
          >
            {isBusy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
