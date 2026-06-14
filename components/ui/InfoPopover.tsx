"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type InfoPopoverProps = {
  label: string;
  children: React.ReactNode;
};

export function InfoPopover({ label, children }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-30 w-72 rounded-2xl border border-transparent shadow-card bg-white p-3 text-sm text-slate-700 shadow-md">
          {children}
        </div>
      ) : null}
    </div>
  );
}

type DataGapsPopoverProps = {
  sku: string;
  gaps: string[];
};

export function DataGapsPopover({ sku, gaps }: DataGapsPopoverProps) {
  if (gaps.length === 0) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <InfoPopover label={`View data gaps for ${sku}`}>
      <p className="mb-2 font-medium text-slate-900">Data gaps</p>
      <ul className="list-disc space-y-1 pl-4">
        {gaps.map((gap) => (
          <li key={gap}>{gap}</li>
        ))}
      </ul>
    </InfoPopover>
  );
}
