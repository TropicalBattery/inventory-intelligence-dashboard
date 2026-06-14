"use server";

import { getAIExplanationSafe } from "@/lib/ai/client";
import {
  getCachedExplanation,
  hashPayload,
  storeCachedExplanation,
} from "@/lib/ai/explanation-store";
import {
  buildPortfolioFallbackSummary,
  buildPortfolioSummaryPrompt,
  buildReorderItemInputHash,
  buildReorderItemPrompt,
  buildTrendAwareFallbackExplanation,
  type PortfolioSummaryPayload,
} from "@/lib/ai/prompts";
import {
  getReorderRecommendationForSku,
  getVelocityDiagnosticForSku,
} from "@/lib/queries/velocity";

export type ExplanationSource = "ai" | "cache" | "fallback";

export type ReorderItemExplanationResult = {
  explanation: string;
  source: ExplanationSource;
  dataGaps: string[];
};

export async function fetchReorderItemExplanation(
  sku: string
): Promise<ReorderItemExplanationResult> {
  const rec = await getReorderRecommendationForSku(sku);

  if (!rec) {
    return {
      explanation: "Item not found in reorder inputs.",
      source: "fallback",
      dataGaps: [],
    };
  }

  const velocity = await getVelocityDiagnosticForSku(sku, rec);
  const inputHash = hashPayload(buildReorderItemInputHash(rec, velocity));
  const cached = await getCachedExplanation("reorder_item", sku, inputHash);

  if (cached) {
    return {
      explanation: cached,
      source: "cache",
      dataGaps: rec.dataGaps,
    };
  }

  const prompt = buildReorderItemPrompt(rec, velocity);
  const fallback = buildTrendAwareFallbackExplanation(rec, velocity);
  const { text, fromAI } = await getAIExplanationSafe(prompt, fallback);

  if (fromAI) {
    await storeCachedExplanation("reorder_item", sku, inputHash, text);
  }

  return {
    explanation: text,
    source: fromAI ? "ai" : "fallback",
    dataGaps: rec.dataGaps,
  };
}

export type PortfolioSummaryResult = {
  summary: string;
  source: ExplanationSource;
};

export async function fetchReorderPortfolioSummary(
  payload: PortfolioSummaryPayload,
  bypassCache = false
): Promise<PortfolioSummaryResult> {
  const inputHash = hashPayload(payload);

  if (!bypassCache) {
    const cached = await getCachedExplanation(
      "portfolio_summary",
      null,
      inputHash
    );

    if (cached) {
      return { summary: cached, source: "cache" };
    }
  }

  const prompt = buildPortfolioSummaryPrompt(payload);
  const fallback = buildPortfolioFallbackSummary(payload);
  const { text, fromAI } = await getAIExplanationSafe(prompt, fallback);

  if (fromAI) {
    await storeCachedExplanation("portfolio_summary", null, inputHash, text);
  }

  return {
    summary: text,
    source: fromAI ? "ai" : "fallback",
  };
}
