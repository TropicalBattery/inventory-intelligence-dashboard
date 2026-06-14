import { describe, expect, it } from "vitest";
import { splitAiParagraphs } from "@/lib/ai/format-text";

describe("splitAiParagraphs", () => {
  it("splits text on blank lines", () => {
    expect(
      splitAiParagraphs("First paragraph.\n\nSecond paragraph.")
    ).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("returns a single paragraph when no blank line is present", () => {
    expect(splitAiParagraphs("One block of text.")).toEqual([
      "One block of text.",
    ]);
  });
});
