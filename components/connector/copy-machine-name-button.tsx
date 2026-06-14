"use client";

type CopyMachineNameButtonProps = {
  value: string;
};

export function CopyMachineNameButton({ value }: CopyMachineNameButtonProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access may be unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy machine name"
      className="shrink-0 text-[#9CA3AF] transition-colors hover:text-[#111111] dark:text-[#9CA3AF] dark:hover:text-[#F4F4F5]"
    >
      <i className="ti ti-copy text-sm" aria-hidden="true" />
    </button>
  );
}
