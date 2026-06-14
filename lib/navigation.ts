export type NavItem = {
  href: string;
  label: string;
  iconClass: string;
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
  { href: "/reference-data", label: "Reference Data", iconClass: "ti-database" },
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
  "/reference-data": "Reference Data",
  "/connector-health": "Connector Health",
};

export const pageSubtitles: Record<string, string> = {
  "/dashboard": "Tropical Battery Company Limited",
  "/reorder": "Review and action reorder recommendations",
  "/inventory": "Browse on-hand inventory across all SKUs",
  "/purchase-orders": "Manage purchase orders and drafts",
  "/reference-data": "Maintain supplier and item reference data",
  "/connector-health": "Monitor connector sync status and health",
};

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  if (pathname.startsWith("/purchase-orders/new")) {
    return "New Purchase Order";
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

  if (pathname.startsWith("/purchase-orders/new")) {
    return "Review draft selections before sending";
  }

  return undefined;
}

export const TENANT_DISPLAY_NAME = "Tropical Battery";
