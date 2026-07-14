"use client";

import { Fragment, type ReactNode } from "react";

type AiChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  isError?: boolean;
};

type ParsedBlock =
  | { type: "heading"; level: 3 | 4; content: string }
  | { type: "paragraph"; content: string }
  | { type: "hr" }
  | { type: "ordered_list"; items: string[] }
  | { type: "unordered_list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

const MAX_TABLE_ROWS = 20;
const HEADING_CLASS =
  "text-sm font-semibold text-[#111111] mt-3 mb-1 dark:text-slate-100";
const PARAGRAPH_CLASS = "mb-2 leading-relaxed";

function splitTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line);
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function matchHeading(line: string): { level: 3 | 4; content: string } | null {
  const match = /^(#{3,4})\s+(.+)$/.exec(line.trim());
  if (!match) {
    return null;
  }

  const hashes = match[1] ?? "";
  const content = (match[2] ?? "").trim();
  if (!content) {
    return null;
  }

  if (hashes.length === 4) {
    return { level: 4, content };
  }

  if (hashes.length === 3) {
    return { level: 3, content };
  }

  return null;
}

function matchOrderedItem(line: string): string | null {
  const match = /^\d+\.\s+(.+)$/.exec(line.trim());
  return match?.[1]?.trim() ?? null;
}

function matchBulletItem(line: string): string | null {
  const match = /^[-*]\s+(.+)$/.exec(line.trim());
  return match?.[1]?.trim() ?? null;
}

function parseMarkdownBlocks(content: string): ParsedBlock[] {
  const lines = content.split("\n");
  const blocks: ParsedBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      const headerCells = splitTableRow(trimmed);
      const separatorLine = lines[index + 1]?.trim() ?? "";

      if (headerCells.length > 0 && isTableSeparator(separatorLine)) {
        const rows: string[][] = [];
        index += 2;

        while (index < lines.length) {
          const rowLine = lines[index]?.trim() ?? "";
          if (!isTableRow(rowLine)) {
            break;
          }

          rows.push(splitTableRow(rowLine));
          index += 1;
        }

        blocks.push({ type: "table", headers: headerCells, rows });
        continue;
      }
    }

    const heading = matchHeading(trimmed);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading.level,
        content: heading.content,
      });
      index += 1;
      continue;
    }

    const orderedFirst = matchOrderedItem(trimmed);
    if (orderedFirst !== null) {
      const items: string[] = [orderedFirst];
      index += 1;

      while (index < lines.length) {
        const next = matchOrderedItem(lines[index] ?? "");
        if (next === null) {
          break;
        }

        items.push(next);
        index += 1;
      }

      blocks.push({ type: "ordered_list", items });
      continue;
    }

    const bulletFirst = matchBulletItem(trimmed);
    if (bulletFirst !== null) {
      const items: string[] = [bulletFirst];
      index += 1;

      while (index < lines.length) {
        const next = matchBulletItem(lines[index] ?? "");
        if (next === null) {
          break;
        }

        items.push(next);
        index += 1;
      }

      blocks.push({ type: "unordered_list", items });
      continue;
    }

    const paragraphLines: string[] = [trimmed];
    index += 1;

    while (index < lines.length) {
      const nextRaw = lines[index] ?? "";
      const nextTrimmed = nextRaw.trim();

      if (!nextTrimmed) {
        break;
      }

      if (
        nextTrimmed === "---" ||
        nextTrimmed === "***" ||
        nextTrimmed === "___" ||
        matchHeading(nextTrimmed) ||
        matchOrderedItem(nextTrimmed) !== null ||
        matchBulletItem(nextTrimmed) !== null ||
        (isTableRow(nextTrimmed) &&
          isTableSeparator(lines[index + 1]?.trim() ?? ""))
      ) {
        break;
      }

      paragraphLines.push(nextTrimmed);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      content: paragraphLines.join(" "),
    });
  }

  return blocks;
}

/** Split on **bold** pairs into React text / <strong> nodes. */
function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let part = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${part}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>
      );
      part += 1;
    }

    nodes.push(
      <strong key={`${keyPrefix}-b-${part}`} className="font-semibold">
        {match[1]}
      </strong>
    );
    part += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-t-${part}`}>
        {text.slice(lastIndex)}
      </Fragment>
    );
  }

  return nodes.length > 0 ? nodes : [text];
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms] dark:bg-slate-400" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms] dark:bg-slate-400" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms] dark:bg-slate-400" />
    </span>
  );
}

function MarkdownTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const visibleRows = rows.slice(0, MAX_TABLE_ROWS);

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {headers.map((header, headerIndex) => (
              <th
                key={`h-${headerIndex}-${header}`}
                className="bg-slate-500/10 px-2 py-1 text-left font-medium text-slate-900 dark:bg-slate-400/10 dark:text-slate-100"
              >
                {renderInlineMarkdown(header, `th-${headerIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`cell-${rowIndex}-${cellIndex}`}
                  className="border-t border-slate-200 px-2 py-1 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  {renderInlineMarkdown(cell, `td-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > MAX_TABLE_ROWS ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Showing {MAX_TABLE_ROWS} of {rows.length} results
        </p>
      ) : null}
    </div>
  );
}

function AssistantContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <h4 key={`h-${index}`} className={HEADING_CLASS}>
                {renderInlineMarkdown(block.content, `h-${index}`)}
              </h4>
            );
          case "hr":
            return (
              <hr
                key={`hr-${index}`}
                className="my-3 border-0 border-t border-[#E5E7EB] dark:border-slate-700"
              />
            );
          case "ordered_list":
            return (
              <ol
                key={`ol-${index}`}
                className="mb-2 list-decimal space-y-1 pl-5"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`ol-${index}-${itemIndex}`}>
                    {renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}
                  </li>
                ))}
              </ol>
            );
          case "unordered_list":
            return (
              <ul key={`ul-${index}`} className="mb-2 list-disc space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={`ul-${index}-${itemIndex}`}>
                    {renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <MarkdownTable
                key={`table-${index}`}
                headers={block.headers}
                rows={block.rows}
              />
            );
          case "paragraph":
            return (
              <p key={`p-${index}`} className={PARAGRAPH_CLASS}>
                {renderInlineMarkdown(block.content, `p-${index}`)}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function AiChatMessage({
  role,
  content,
  isLoading = false,
  isError = false,
}: AiChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-tbc-red px-4 py-2.5 text-sm text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="mr-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-tbc-red-light ">
        <i
          className="ti ti-sparkles text-xs text-tbc-red dark:text-tbc-red"
          aria-hidden="true"
        />
      </div>
      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm ${
          isError
            ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        {isLoading ? (
          <LoadingDots />
        ) : isError ? (
          content
        ) : (
          <AssistantContent content={content} />
        )}
      </div>
    </div>
  );
}
