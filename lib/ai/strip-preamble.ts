const INLINE_PREAMBLE_PATTERN =
  /^(?:Here is(?: a)?|Here's|Sure,|Certainly,|Of course,|Absolutely,)[^:\n]*:\s*/i;

const BLOCK_PREAMBLE_PATTERN =
  /^(?:Here is(?: a)?|Here's|Sure,|Certainly,|Of course,|Absolutely,)[^:\n]*:\s*\n+/i;

function removeWrappingQuotes(text: string): string {
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).trim();
  }

  return text;
}

export function stripAiPreamble(text: string): string {
  let cleaned = removeWrappingQuotes(text.trim());

  while (BLOCK_PREAMBLE_PATTERN.test(cleaned)) {
    cleaned = cleaned.replace(BLOCK_PREAMBLE_PATTERN, "").trim();
  }

  if (INLINE_PREAMBLE_PATTERN.test(cleaned)) {
    cleaned = cleaned.replace(INLINE_PREAMBLE_PATTERN, "").trim();
  }

  return cleaned;
}
