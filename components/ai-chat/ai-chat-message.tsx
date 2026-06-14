"use client";

type AiChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  isError?: boolean;
};

type ParsedBlock =
  | { type: "text"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] };

const MAX_TABLE_ROWS = 20;

function parseMarkdownBlocks(content: string): ParsedBlock[] {
  const lines = content.split("\n");
  const blocks: ParsedBlock[] = [];
  let textBuffer: string[] = [];
  let index = 0;

  function flushText() {
    if (textBuffer.length === 0) {
      return;
    }

    blocks.push({ type: "text", content: textBuffer.join("\n").trim() });
    textBuffer = [];
  }

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";

    if (line.startsWith("|") && line.endsWith("|")) {
      const headerCells = splitTableRow(line);
      const separatorLine = lines[index + 1]?.trim() ?? "";

      if (
        headerCells.length > 0 &&
        /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(separatorLine)
      ) {
        flushText();

        const rows: string[][] = [];
        index += 2;

        while (index < lines.length) {
          const rowLine = lines[index]?.trim() ?? "";
          if (!rowLine.startsWith("|") || !rowLine.endsWith("|")) {
            break;
          }

          rows.push(splitTableRow(rowLine));
          index += 1;
        }

        blocks.push({ type: "table", headers: headerCells, rows });
        continue;
      }
    }

    textBuffer.push(lines[index] ?? "");
    index += 1;
  }

  flushText();
  return blocks;
}

function splitTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
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
            {headers.map((header) => (
              <th
                key={header}
                className="bg-slate-500/10 px-2 py-1 text-left font-medium text-slate-900 dark:bg-slate-400/10 dark:text-slate-100"
              >
                {header}
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
                  {cell}
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
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "text") {
          if (!block.content) {
            return null;
          }

          return (
            <p key={`text-${index}`} className="whitespace-pre-wrap">
              {block.content}
            </p>
          );
        }

        return (
          <MarkdownTable
            key={`table-${index}`}
            headers={block.headers}
            rows={block.rows}
          />
        );
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
