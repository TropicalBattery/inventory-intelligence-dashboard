"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AiChatMessage } from "@/components/ai-chat/ai-chat-message";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
  isError?: boolean;
};

type AiChatSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SUGGESTION_CHIPS = [
  "Which SKUs are below reorder level?",
  "What is my Atlas supplier exposure?",
  "Show items with no sales in 90 days",
  "Top 10 SKUs by inventory value",
] as const;

export function AiChatSidebar({ isOpen, onClose }: AiChatSidebarProps) {
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
  }, [pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const submitMessage = useCallback(
    async (rawMessage: string) => {
      const trimmed = rawMessage.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
      ];

      setMessages(nextMessages);
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: nextMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        });

        const data = (await response.json()) as { reply?: string };

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              data.reply ??
              "Something went wrong. Please try again.",
            isError: !response.ok,
          },
        ]);
      } catch {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: "Something went wrong. Please try again.",
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    void submitMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  return (
    <aside
      className={`fixed right-0 top-0 z-40 flex h-full w-[420px] flex-col border-l border-slate-200 bg-white transition-transform duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-950 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!isOpen}
    >
      <header className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <i
            className="ti ti-sparkles text-lg text-tbc-red"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Inventory AI
          </span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-300">
            Live data
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close chat sidebar"
        >
          <i className="ti ti-x text-lg" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="rounded-lg bg-slate-100/60 p-4 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          <p>
            Hi, I can answer questions about your inventory, suppliers, sales,
            and purchase orders. Try asking:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void submitMessage(chip)}
                disabled={isLoading}
                className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:border-tbc-red hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-tbc-red dark:hover:bg-slate-800"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {messages.map((message, index) => (
          <AiChatMessage
            key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
            role={message.role}
            content={message.content}
            isError={message.isError}
          />
        ))}

        {isLoading ? (
          <AiChatMessage role="assistant" content="" isLoading />
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your inventory..."
          rows={1}
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-2xl border border-transparent shadow-card bg-white px-3 py-2 text-sm text-slate-900 focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-tbc-red hover:bg-tbc-red-light0 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          <i className="ti ti-send text-sm text-white" aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
