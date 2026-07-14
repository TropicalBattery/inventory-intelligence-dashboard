"use client";

type AiChatButtonProps = {
  isOpen: boolean;
  onToggle: () => void;
};

export function AiChatButton({ isOpen, onToggle }: AiChatButtonProps) {
  if (isOpen) {
    return null;
  }

  return (
    <div className="group fixed bottom-6 right-6 z-50">
      <span className="pointer-events-none absolute bottom-16 right-0 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Ask AI
      </span>

      <button
        type="button"
        onClick={onToggle}
        aria-label="Open AI chat"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-tbc-red shadow-lg transition-all duration-200 hover:bg-tbc-red-hover"
      >
        <i
          className="ti ti-sparkles text-[24px] text-white transition-transform duration-1000 group-hover:animate-spin"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
