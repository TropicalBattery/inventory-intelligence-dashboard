"use client";

type AiChatButtonProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export function AiChatButton({ isOpen, onToggle }: AiChatButtonProps) {
  return (
    <div className="group fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <span className="pointer-events-none absolute bottom-16 right-0 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Ask AI
        </span>
      ) : null}

      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
          isOpen
            ? "bg-gray-700 hover:bg-gray-600"
            : "bg-tbc-red hover:bg-tbc-red-hover"
        }`}
      >
        {isOpen ? (
          <i className="ti ti-x text-[20px] text-white" aria-hidden="true" />
        ) : (
          <i
            className="ti ti-sparkles text-[24px] text-white transition-transform duration-1000 group-hover:animate-spin"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
