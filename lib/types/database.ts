export type ConnectorHeartbeat = {
  id: string;
  tenant_id: string;
  connector_id: string | null;
  status: string | null;
  version: string | null;
  uptime_seconds: number | null;
  sent_at: string;
};

export type ConnectorSyncStatus = {
  id: string;
  tenant_id: string;
  connector_id: string | null;
  job_name: string | null;
  status: string | null;
  records_read: number | null;
  records_pushed: number | null;
  records_failed: number | null;
  started_at: string | null;
  completed_at: string | null;
};

export type ProductRow = {
  id: string;
  sku: string | null;
  external_id: string;
  name: string | null;
  cost_price: number | null;
};

export type InventoryBalanceRow = {
  sku: string | null;
  product_external_id: string | null;
  quantity_on_hand: number | null;
  quantity_available: number | null;
  reorder_level: number | null;
};

export type ItemCostingRow = {
  sku: string | null;
  product_external_id: string | null;
  current_cost_local: number | null;
};

export type ReorderPreviewItem = {
  sku: string;
  name: string;
  quantityAvailable: number;
  reorderLevel: number;
  shortfall: number;
};
