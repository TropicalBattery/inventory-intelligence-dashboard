import { afterEach, describe, expect, it, vi } from "vitest";
import { getAIExplanationSafe } from "@/lib/ai/client";

describe("getAIExplanationSafe", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }

    vi.restoreAllMocks();
  });

  it("returns fallback text when API key is invalid", async () => {
    process.env.ANTHROPIC_API_KEY = "invalid-key-for-test";

    const result = await getAIExplanationSafe(
      "Write one sentence about inventory.",
      "Fallback explanation text."
    );

    expect(result.fromAI).toBe(false);
    expect(result.text).toBe("Fallback explanation text.");
  });

  it("returns fallback text when API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const result = await getAIExplanationSafe(
      "Write one sentence about inventory.",
      "Missing key fallback."
    );

    expect(result.fromAI).toBe(false);
    expect(result.text).toBe("Missing key fallback.");
  });
});
