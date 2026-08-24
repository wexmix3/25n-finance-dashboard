"use client";

import type { ItemReviewApi, ItemType } from "./GLCheckTab";

/** Bulk-approve every currently unapproved item in a panel — Variance
 * Detail, Control # & Vendor Issues, and Journal Entry Review each reused
 * the same one-at-a-time ItemApproveButton with no way to clear a whole
 * section at once (2026-08-24 UI audit finding: reviewing 20 flagged items
 * meant 20 individual clicks). Uses the same reversible toggle as a single
 * approve, just looped — an accidental bulk-approve is still one click per
 * item to undo via ItemApproveButton, same as today. */
export function ApproveAllButton({
  itemType,
  keys,
  reviewApi,
}: {
  itemType: ItemType;
  keys: string[];
  reviewApi: ItemReviewApi;
}) {
  const unapproved = keys.filter((k) => !reviewApi.isApproved(itemType, k));
  if (unapproved.length === 0) return null;

  return (
    <button
      onClick={() => unapproved.forEach((k) => reviewApi.toggle(itemType, k))}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors duration-150 cursor-pointer"
      title={`Approve all ${unapproved.length} unapproved item${unapproved.length !== 1 ? "s" : ""} below`}
    >
      Approve all ({unapproved.length})
    </button>
  );
}
