"use server";

import { getAIExplanationSafe } from "@/lib/ai/client";
import {
  buildPoCoverNoteFallback,
  buildPoCoverNotePrompt,
  type PoCoverNotePayload,
} from "@/lib/ai/prompts";
import { stripAiPreamble } from "@/lib/ai/strip-preamble";

export type PoCoverNoteResult = {
  note: string;
  source: "ai" | "fallback";
};

export async function generatePoCoverNote(
  payload: PoCoverNotePayload
): Promise<PoCoverNoteResult> {
  const prompt = buildPoCoverNotePrompt(payload);
  const fallback = buildPoCoverNoteFallback(payload);
  const { text, fromAI } = await getAIExplanationSafe(prompt, fallback);

  return {
    note: stripAiPreamble(text),
    source: fromAI ? "ai" : "fallback",
  };
}
