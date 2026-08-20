"use client";

import { useState } from "react";
import type { ItemNoteApi, ItemType } from "./GLCheckTab";

const MAX_LEN = 500;

/** Inline note editor, rendered as a full-width sub-row directly under a
 * flagged item — same expand-in-place shape the transaction-detail rows
 * already use elsewhere in these panels, so it reads as the same pattern
 * rather than a new one. Autosaves on blur only (not per keystroke), so
 * typing never triggers a network call. */
export function ItemNoteRow({
  itemType,
  itemKey,
  notesApi,
  colSpan,
}: {
  itemType: ItemType;
  itemKey: string;
  notesApi: ItemNoteApi;
  colSpan: number;
}) {
  const [draft, setDraft] = useState(() => notesApi.getNote(itemType, itemKey));
  const [saved, setSaved] = useState(true);

  function commit() {
    if (draft.trim() !== notesApi.getNote(itemType, itemKey)) {
      notesApi.saveNote(itemType, itemKey, draft.trim());
    }
    setSaved(true);
  }

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-2.5 bg-amber-50/50">
        <textarea
          value={draft}
          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_LEN)); setSaved(false); }}
          onBlur={commit}
          placeholder="Add a note — why this is flagged, who to follow up with, resolution context..."
          rows={2}
          className="w-full text-xs text-gray-700 bg-white border border-amber-200 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-400">{saved ? "Saved" : "Saving on blur..."}</span>
          <span className="text-[10px] text-gray-400">{draft.length}/{MAX_LEN}</span>
        </div>
      </td>
    </tr>
  );
}
