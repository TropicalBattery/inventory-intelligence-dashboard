export type PanelId = "cart" | "ai";

type PanelListener = (panel: PanelId) => void;

/**
 * Tiny pub/sub so cart and AI panels stay mutually exclusive
 * without importing each other's providers.
 */
export const panelBus = {
  listeners: new Set<PanelListener>(),
  open(panel: PanelId) {
    this.listeners.forEach((fn) => fn(panel));
  },
  subscribe(fn: PanelListener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },
};
