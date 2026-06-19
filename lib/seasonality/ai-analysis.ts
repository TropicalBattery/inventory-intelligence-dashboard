import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL } from "@/lib/ai/config";
import type { SeasonalIntelligenceAnalysis } from "@/lib/seasonality/types";

const SEASONAL_AI_MAX_TOKENS = 4000;

export const TRUNCATED_SEASONAL_ANALYSIS_FALLBACK: SeasonalIntelligenceAnalysis = {
  seasonal_categories: [],
  spike_skus: [],
  summary:
    "Seasonal pattern data was collected but the AI summary could not be generated. Review peak month indexes in item costing profiles directly.",
};

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function parseSeasonalAnalysis(
  text: string
): Partial<SeasonalIntelligenceAnalysis> | null {
  const candidates = [text.trim(), extractJsonObject(text)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Partial<SeasonalIntelligenceAnalysis>;
    } catch {
      // fall through to slice extraction
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Partial<
        SeasonalIntelligenceAnalysis
      >;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeSeasonalAnalysis(
  parsed: Partial<SeasonalIntelligenceAnalysis>
): SeasonalIntelligenceAnalysis {
  return {
    seasonal_categories: Array.isArray(parsed.seasonal_categories)
      ? parsed.seasonal_categories.map((category) => ({
          item_class: String(category.item_class ?? "Unknown"),
          peak_months: Array.isArray(category.peak_months)
            ? category.peak_months
                .map((month) => Number(month))
                .filter(Number.isFinite)
            : [],
          reason: String(category.reason ?? ""),
          build_stock_by_month: String(category.build_stock_by_month ?? ""),
          strength:
            category.strength === "high" ||
            category.strength === "moderate" ||
            category.strength === "flat"
              ? category.strength
              : "moderate",
        }))
      : [],
    spike_skus: Array.isArray(parsed.spike_skus)
      ? parsed.spike_skus.map((spike) => ({
          item_number: String(spike.item_number ?? ""),
          spike_month: String(spike.spike_month ?? ""),
          likely_reason: String(spike.likely_reason ?? ""),
        }))
      : [],
    summary: String(parsed.summary ?? ""),
  };
}

export function buildFallbackSeasonalAnalysis(
  profileCount: number
): SeasonalIntelligenceAnalysis {
  return {
    seasonal_categories: [],
    spike_skus: [],
    summary: `Seasonality scan completed for ${profileCount} SKUs. AI analysis is unavailable, so review peak month indexes in item costing profiles and reorder warnings for timing guidance.`,
  };
}

export async function runSeasonalIntelligenceAI(
  prompt: string
): Promise<SeasonalIntelligenceAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: SEASONAL_AI_MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
    throw new Error("AI response did not contain text");
  }

  const parsed = parseSeasonalAnalysis(textBlock.text);
  if (parsed === null) {
    console.warn(
      "Seasonal intelligence AI response JSON could not be parsed; using truncated fallback summary"
    );
    return TRUNCATED_SEASONAL_ANALYSIS_FALLBACK;
  }

  return normalizeSeasonalAnalysis(parsed);
}

export async function runSeasonalIntelligenceAISafe(
  prompt: string,
  profileCount: number
): Promise<{ analysis: SeasonalIntelligenceAnalysis; fromAI: boolean }> {
  try {
    const analysis = await runSeasonalIntelligenceAI(prompt);
    const fromAI =
      analysis.summary !== TRUNCATED_SEASONAL_ANALYSIS_FALLBACK.summary;
    return { analysis, fromAI };
  } catch (error) {
    console.error("Seasonal intelligence AI failed:", error);
    return {
      analysis: buildFallbackSeasonalAnalysis(profileCount),
      fromAI: false,
    };
  }
}
