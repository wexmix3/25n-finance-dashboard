"use client";

import type { ItemNoteApi, ItemType } from "./GLCheckTab";

/** Small note-icon toggle, shared across GL Variance Detail, Control# &
 * Vendor Issues, and Journal Entry Review. Filled/amber when a note already
 * exists so reviewers can spot which flagged items have context without
 * opening every row — outline when empty. Click opens/closes the inline
 * editor row; owning panel controls the open state. */
export function ItemNoteButton({
  itemType,
  itemKey,
  notesApi,
  isOpen,
  onToggle,
}: {
  itemType: ItemType;
  itemKey: string;
  notesApi: ItemNoteApi;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasNote = notesApi.getNote(itemType, itemKey).length > 0;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={[
        "inline-flex items-center justify-center w-6 h-6 rounded transition-colors duration-150 cursor-pointer",
        isOpen
          ? "bg-gray-100 text-gray-600"
          : hasNote
          ? "text-amber-600 hover:bg-amber-50"
          : "text-gray-300 hover:text-gray-500 hover:bg-gray-50",
      ].join(" ")}
      title={hasNote ? "Note attached — click to view/edit" : "Add a note"}
    >
      <svg className="w-3.5 h-3.5" fill={hasNote ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L9.75 17.539l-4.243.707.707-4.243 10.648-10.516Z" />
      </svg>
    </button>
  );
}
