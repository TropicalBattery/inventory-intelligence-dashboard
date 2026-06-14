import { describe, expect, it } from "vitest";
import { stripAiPreamble } from "@/lib/ai/strip-preamble";

describe("stripAiPreamble", () => {
  it("removes inline cover note preamble text", () => {
    const input =
      "Here is a draft cover note for the purchase order:\n\nThis purchase order has been raised for replenishment.";

    expect(stripAiPreamble(input)).toBe(
      "This purchase order has been raised for replenishment."
    );
  });

  it("removes Here's and Sure, style preambles", () => {
    expect(stripAiPreamble("Here's the cover note:\n\nPlease supply items.")).toBe(
      "Please supply items."
    );
    expect(stripAiPreamble("Sure, here is the memo: Please confirm delivery.")).toBe(
      "Please confirm delivery."
    );
  });

  it("removes wrapping quotation marks", () => {
    expect(stripAiPreamble('"Please supply the listed items."')).toBe(
      "Please supply the listed items."
    );
  });
});
