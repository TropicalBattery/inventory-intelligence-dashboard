import { createHash } from "crypto";

export function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const memoryCache = new Map<string, string>();

export function getMemoryCachedExplanation(key: string): string | null {
  return memoryCache.get(key) ?? null;
}

export function setMemoryCachedExplanation(key: string, explanation: string): void {
  memoryCache.set(key, explanation);
}

export function buildCacheKey(
  tenantId: string,
  explanationType: string,
  sku: string | null,
  inputHash: string
): string {
  return `${tenantId}:${explanationType}:${sku ?? "global"}:${inputHash}`;
}
