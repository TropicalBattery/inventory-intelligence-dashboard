/**
 * Shared constants and helpers for AI chat history / result size bounds.
 */

export const MAX_AI_RESULT_ROWS = 30;
export const MAX_RESULT_CHARS = 12_000;
export const MAX_TOOL_ITERATIONS = 5;
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_HISTORY_MESSAGES = 40;
/** Client-side: max user messages per session before requiring a new chat. */
export const MAX_TURNS = 20;

export const OMITTED_TOOL_RESULT =
  "[Query result omitted for brevity - key findings are reflected in the assistant analysis above]";

export const FORCE_ANSWER_MESSAGE =
  "Answer now with the information gathered so far.";

export const HISTORY_TRIMMED_NOTE =
  "Earlier conversation turns were trimmed for length.";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

function isChatRole(value: unknown): value is "user" | "assistant" {
  return value === "user" || value === "assistant";
}

export function truncateMessageContent(
  content: string,
  maxChars: number = MAX_MESSAGE_CHARS
): string {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}... [truncated]`;
}

/**
 * Validate/coerce inbound chat history: keep well-formed plain-text turns,
 * truncate long content, and keep at most MAX_HISTORY_MESSAGES (most recent).
 */
export function sanitizeChatHistory(
  raw: unknown
): {
  messages: ChatHistoryMessage[];
  wasTrimmed: boolean;
} {
  if (!Array.isArray(raw)) {
    return { messages: [], wasTrimmed: false };
  }

  const coerced: ChatHistoryMessage[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    if (!isChatRole(record.role) || typeof record.content !== "string") {
      continue;
    }

    const content = record.content.trim();
    if (!content) {
      continue;
    }

    coerced.push({
      role: record.role,
      content: truncateMessageContent(content),
    });
  }

  if (coerced.length <= MAX_HISTORY_MESSAGES) {
    return { messages: coerced, wasTrimmed: false };
  }

  return {
    messages: coerced.slice(-MAX_HISTORY_MESSAGES),
    wasTrimmed: true,
  };
}

/**
 * Cap tool_result payload: at most MAX_AI_RESULT_ROWS, then shrink until
 * serialized JSON is under MAX_RESULT_CHARS.
 */
export function formatQueryRowsForTool(
  rows: Record<string, unknown>[],
  rowCount: number
): string {
  if (rowCount === 0 || rows.length === 0) {
    return "Query returned no results.";
  }

  let limited = rows.slice(0, MAX_AI_RESULT_ROWS);
  let note: string | null =
    rowCount > MAX_AI_RESULT_ROWS
      ? `Showing ${MAX_AI_RESULT_ROWS} of ${rowCount} rows. Narrow the query or aggregate for full coverage.`
      : null;

  while (limited.length > 0) {
    const serialized = JSON.stringify(limited, null, 2);
    if (serialized.length <= MAX_RESULT_CHARS) {
      const header = note
        ? `Query returned ${rowCount} rows. ${note}`
        : limited.length < rows.slice(0, MAX_AI_RESULT_ROWS).length
          ? `Query returned ${rowCount} rows. Showing ${limited.length} of ${rowCount} rows (truncated to fit context size).`
          : `Query returned ${rowCount} rows:`;

      return `${header}\n${serialized}`;
    }

    if (limited.length === 1) {
      const truncatedRow = JSON.stringify(limited[0]).slice(0, MAX_RESULT_CHARS);
      return `Query returned ${rowCount} rows. Showing 1 truncated row (fit under size limit):\n${truncatedRow}... [truncated]`;
    }

    limited = limited.slice(0, Math.max(1, Math.floor(limited.length / 2)));
    note = `Showing ${limited.length} of ${rowCount} rows. Narrow the query or aggregate for full coverage.`;
  }

  return `Query returned ${rowCount} rows but results exceeded the size limit.`;
}
