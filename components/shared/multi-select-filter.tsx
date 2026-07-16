"use client";

import { useEffect, useId, useRef, useState } from "react";

export type MultiSelectFilterOption = {
  value: string;
  label: string;
};

type MultiSelectFilterProps = {
  label: string;
  options: MultiSelectFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  className?: string;
};

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) {
        return;
      }
      if (!root.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectedSet = new Set(selected);
  const selectedOptions = options.filter((option) =>
    selectedSet.has(option.value)
  );

  let triggerLabel = placeholder;
  if (selectedOptions.length === 1) {
    triggerLabel = selectedOptions[0].label;
  } else if (selectedOptions.length > 1) {
    triggerLabel = `${selectedOptions[0].label} +${selectedOptions.length - 1}`;
  }

  const isActive = selected.length > 0;

  function toggleValue(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((entry) => entry !== value));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div ref={rootRef} className={["relative", className].filter(Boolean).join(" ")}>
      <label
        id={labelId}
        className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]"
      >
        {label}
      </label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={[
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm text-[#111111]",
          isActive
            ? "border-[#CC2B2B]/40 bg-[#FDF2F2]/50"
            : "border-[#E5E7EB] bg-white",
        ].join(" ")}
      >
        <span className="min-w-0 truncate">{triggerLabel}</span>
        <span className="shrink-0 text-[#9CA3AF]" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 max-h-64 w-full min-w-[180px] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white shadow-lg"
        >
          {selected.length > 0 ? (
            <div className="border-b border-[#E5E7EB] px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-sm text-[#CC2B2B] hover:underline"
              >
                Clear
              </button>
            </div>
          ) : null}
          {options.map((option) => {
            const checked = selectedSet.has(option.value);
            return (
              <label
                key={option.value}
                role="option"
                aria-selected={checked}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[#111111] hover:bg-[#F9FAFB]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleValue(option.value)}
                  className="h-3.5 w-3.5 rounded border-[#E5E7EB] text-tbc-red focus:ring-tbc-red/20"
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
