import { describe, expect, it } from "vitest";
import {
  MAX_AI_RESULT_ROWS,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  formatQueryRowsForTool,
  sanitizeChatHistory,
} from "@/lib/ai/chat-history";

describe("sanitizeChatHistory", () => {
  it("drops malformed entries and truncates long content", () => {
    const long = "x".repeat(MAX_MESSAGE_CHARS + 50);
    const { messages, wasTrimmed } = sanitizeChatHistory([
      { role: "user", content: "hello" },
      { role: "system", content: "nope" },
      { role: "assistant", content: long },
      null,
      { role: "user" },
    ]);

    expect(wasTrimmed).toBe(false);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe("hello");
    expect(messages[1]?.content.endsWith("... [truncated]")).toBe(true);
    expect(messages[1]?.content.length).toBe(MAX_MESSAGE_CHARS + "... [truncated]".length);
  });

  it("keeps the most recent MAX_HISTORY_MESSAGES and flags trim", () => {
    const raw = Array.from({ length: MAX_HISTORY_MESSAGES + 5 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `m${i}`,
    }));

    const { messages, wasTrimmed } = sanitizeChatHistory(raw);
    expect(wasTrimmed).toBe(true);
    expect(messages).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(messages[0]?.content).toBe("m5");
    expect(messages[messages.length - 1]?.content).toBe(
      `m${MAX_HISTORY_MESSAGES + 4}`
    );
  });
});

describe("formatQueryRowsForTool", () => {
  it("caps injected rows and notes overflow", () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({ sku: `SKU-${i}` }));
    const text = formatQueryRowsForTool(rows, 80);

    expect(text).toContain(`Showing ${MAX_AI_RESULT_ROWS} of 80 rows`);
    expect(text).toContain("SKU-0");
    expect(text).toContain(`SKU-${MAX_AI_RESULT_ROWS - 1}`);
    expect(text).not.toContain("SKU-30");
  });

  it("shrinks further when serialized size exceeds the char cap", () => {
    const fat = "y".repeat(2000);
    const rows = Array.from({ length: 30 }, (_, i) => ({
      sku: `SKU-${i}`,
      blob: fat,
    }));

    const text = formatQueryRowsForTool(rows, 200);
    expect(text).toMatch(/Showing \d+ of 200 rows/);
    expect(text.length).toBeLessThan(20_000);
  });
});
