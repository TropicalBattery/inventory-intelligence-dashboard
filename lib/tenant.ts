/**
 * Single source of truth for the active tenant.
 * Change this constant (or TENANT_ID in .env.local) when onboarding new tenants.
 */
export const TENANT_ID = process.env.TENANT_ID ?? "tropical-battery";
