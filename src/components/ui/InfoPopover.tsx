"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  title: string;
  formula?: string;
  source?: string;
  note?: string;
}

export function InfoPopover({ title, formula, source, note }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center ml-1 align-middle">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="text-gray-300 hover:text-gray-500 transition-colors duration-150 cursor-pointer leading-none"
        aria-label={`About ${title}`}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 4a1 1 0 110 2 1 1 0 010-2zm0 3a1 1 0 011 1v4a1 1 0 11-2 0V8a1 1 0 011-1z"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-50 w-60 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs">
          <p className="font-semibold text-gray-800 mb-2">{title}</p>
          {formula && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Formula</p>
              <p className="text-gray-600">{formula}</p>
            </div>
          )}
          {source && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Source</p>
              <p className="text-gray-500">{source}</p>
            </div>
          )}
          {note && (
            <p className="text-gray-400 italic border-t border-gray-100 pt-2 mt-1">{note}</p>
          )}
        </div>
      )}
    </span>
  );
}
