/** Allowed `user_saved_views.page` keys. */
export const SAVED_VIEW_PAGES = [
  "reorder_action",
  "overstock",
  "inventory",
  "exceptions",
  "non_stock",
  "unclassified",
] as const;

export type SavedViewPage = (typeof SAVED_VIEW_PAGES)[number];

const PAGE_SET = new Set<string>(SAVED_VIEW_PAGES);

export function isSavedViewPage(value: string): value is SavedViewPage {
  return PAGE_SET.has(value);
}

export function coerceSavedViewPage(
  value: unknown,
  fallback: SavedViewPage = "reorder_action"
): SavedViewPage {
  if (typeof value === "string" && isSavedViewPage(value.trim())) {
    return value.trim() as SavedViewPage;
  }
  return fallback;
}
