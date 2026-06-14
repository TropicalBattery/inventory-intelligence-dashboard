import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";
import {
  buildCacheKey,
  getMemoryCachedExplanation,
  hashInput,
  setMemoryCachedExplanation,
} from "@/lib/ai/cache";

export async function getCachedExplanation(
  explanationType: string,
  sku: string | null,
  inputHash: string
): Promise<string | null> {
  const memoryKey = buildCacheKey(TENANT_ID, explanationType, sku, inputHash);
  const memoryHit = getMemoryCachedExplanation(memoryKey);

  if (memoryHit) {
    return memoryHit;
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("ai_explanations")
    .select("explanation")
    .eq("tenant_id", TENANT_ID)
    .eq("explanation_type", explanationType)
    .eq("input_hash", inputHash);

  if (sku) {
    query = query.eq("sku", sku);
  } else {
    query = query.is("sku", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Failed to read AI explanation cache:", error.message);
    return null;
  }

  if (data?.explanation) {
    setMemoryCachedExplanation(memoryKey, data.explanation);
    return data.explanation;
  }

  return null;
}

export async function storeCachedExplanation(
  explanationType: string,
  sku: string | null,
  inputHash: string,
  explanation: string
): Promise<void> {
  const memoryKey = buildCacheKey(TENANT_ID, explanationType, sku, inputHash);
  setMemoryCachedExplanation(memoryKey, explanation);

  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_explanations").upsert(
    {
      tenant_id: TENANT_ID,
      sku,
      explanation_type: explanationType,
      input_hash: inputHash,
      explanation,
      generated_at: new Date().toISOString(),
    },
    {
      onConflict: "tenant_id,explanation_type,input_hash,sku",
    }
  );

  if (error) {
    console.error("Failed to store AI explanation cache:", error.message);
  }
}

export function hashPayload(payload: unknown): string {
  return hashInput(payload);
}
