"use client";

import type { ItemReviewApi, ItemType } from "./GLCheckTab";

/** Small approve/keep-flagged toggle, shared across GL Variance Detail,
 * Control# & Vendor Issues, and Journal Entry Review. Always reversible —
 * clicking an approved item un-approves it, never a one-way action
 * (Christine's 2026-08-19 ask: "you can undo an action if someone
 * accidentally makes a mistake"). */
export function ItemApproveButton({ itemType, itemKey, reviewApi }: { itemType: ItemType; itemKey: string; reviewApi: ItemReviewApi }) {
  const approved = reviewApi.isApproved(itemType, itemKey);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); reviewApi.toggle(itemType, itemKey); }}
      className={[
        "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer",
        approved
          ? "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
          : "bg-white text-gray-400 border border-gray-200 hover:text-gray-600 hover:border-gray-300",
      ].join(" ")}
      title={approved ? "Approved — click to keep flagged again" : "Click to approve"}
    >
      {approved ? (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Approved
        </>
      ) : (
        "Approve"
      )}
    </button>
  );
}
