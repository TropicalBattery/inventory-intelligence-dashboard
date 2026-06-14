import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL } from "@/lib/ai/config";

export type AIExplanationResult = {
  text: string;
  fromAI: boolean;
};

export async function getAIExplanation(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) {
    throw new Error("AI response did not contain text");
  }

  return textBlock.text.trim();
}

export async function getAIExplanationSafe(
  prompt: string,
  fallback: string
): Promise<AIExplanationResult> {
  try {
    const text = await getAIExplanation(prompt);
    return { text, fromAI: true };
  } catch (error) {
    console.error("AI explanation failed:", error);
    return { text: fallback, fromAI: false };
  }
}
