export type NavItem = {
  href: string;
  label: string;
  iconClass: string;
  /** When true, sidebar shows this item only for approvers. */
  approverOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconClass: "ti-layout-dashboard" },
  { href: "/reorder", label: "Reorder", iconClass: "ti-arrows-sort" },
  { href: "/inventory", label: "Inventory", iconClass: "ti-package" },
  {
    href: "/purchase-orders",
    label: "Purchase Orders",
    iconClass: "ti-receipt",
  },
  {
    href: "/inbound-containers",
    label: "Inbound Containers",
    iconClass: "ti-ship",
  },
  { href: "/exceptions", label: "Exceptions", iconClass: "ti-alert-octagon" },
  { href: "/reference-data", label: "Reference Data", iconClass: "ti-database" },
  {
    href: "/users",
    label: "Users",
    iconClass: "ti-users",
    approverOnly: true,
  },
  {
    href: "/connector-health",
    label: "Connector Health",
    iconClass: "ti-activity",
  },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inventory": "Inventory",
  "/reorder": "Reorder",
  "/purchase-orders": "Purchase Orders",
  "/inbound-containers": "Inbound Containers",
  "/exceptions": "Data exceptions",
  "/reference-data": "Reference Data",
  "/users": "Users",
  "/connector-health": "Connector Health",
};

export const pageSubtitles: Record<string, string> = {
  "/dashboard": "Tropical Battery Company Limited",
  "/reorder": "Review and action reorder recommendations",
  "/inventory": "Browse on-hand inventory across all SKUs",
  "/purchase-orders": "Manage purchase orders and drafts",
  "/inbound-containers":
    "Expected inbound containers and pallets from the latest upload",
  "/exceptions":
    "Items needing data cleanup before their numbers can be trusted",
  "/reference-data": "Maintain supplier and item reference data",
  "/users": "Manage roles and password resets",
  "/connector-health": "Monitor connector sync status and health",
};

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  if (pathname.startsWith("/purchase-orders/review")) {
    return "Review cart and create POs";
  }

  if (pathname.startsWith("/purchase-orders/new")) {
    return "Purchase Orders";
  }

  if (pathname.startsWith("/purchase-orders/")) {
    return "Purchase Order";
  }

  return "Inventory Intelligence";
}

export function getPageSubtitle(pathname: string): string | undefined {
  if (pageSubtitles[pathname]) {
    return pageSubtitles[pathname];
  }

  if (pathname.startsWith("/purchase-orders/review")) {
    return "Review grouped cart lines and create supplier purchase orders";
  }

  return undefined;
}

export const TENANT_DISPLAY_NAME = "Tropical Battery";
