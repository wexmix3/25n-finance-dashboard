"use client";

import { useState } from "react";
import type { FinancialData, GlItemReview, GlItemNote } from "@/types/dashboard";
import { GLVariancePanel } from "./GLVariancePanel";
import { ControlViolationsPanel } from "./ControlViolationsPanel";
import { JournalEntryPanel } from "./JournalEntryPanel";

interface Props {
  currentData: FinancialData;
  priorMonth: string;
  uploadedAt?: string;
  reviewed?: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  onReviewChange?: (reviewed: boolean) => void;
  /** Already-approved items for this location/month, from gl_item_reviews. */
  itemReviews: GlItemReview[];
  /** Existing free-text notes for this location/month, from gl_item_notes. */
  itemNotes: GlItemNote[];
}

export type ItemType = "variance" | "control" | "je";

/** Shared approve/keep-flagged handle passed to all three flagged-item
 * panels. Reversible by construction (Christine's 2026-08-19 ask) — the
 * same toggle call approves or un-approves depending on current state, and
 * the API route upserts or deletes accordingly. */
export interface ItemReviewApi {
  isApproved: (itemType: ItemType, itemKey: string) => boolean;
  toggle: (itemType: ItemType, itemKey: string) => void;
}

/** Free-text note read/save, same optimistic-update-then-revert-on-failure
 * shape as ItemReviewApi. Independent of approval — a note can exist on an
 * item regardless of its approved state. */
export interface ItemNoteApi {
  getNote: (itemType: ItemType, itemKey: string) => string;
  saveNote: (itemType: ItemType, itemKey: string, note: string) => void;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function GLCheckTab({ currentData, priorMonth, uploadedAt, reviewed, reviewedBy, reviewedAt, onReviewChange, itemReviews, itemNotes }: Props) {
  const [pending, setPending] = useState(false);
  const [localReviewed, setLocalReviewed] = useState(reviewed ?? false);
  const [localReviewedBy, setLocalReviewedBy] = useState(reviewedBy ?? null);
  const [localReviewedAt, setLocalReviewedAt] = useState(reviewedAt ?? null);

  // Optimistic local overrides, keyed "itemType|itemKey" -> approved. Falls
  // back to the server-provided itemReviews when a key has no override yet.
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, boolean>>({});

  const serverApprovedKeys = new Set(itemReviews.map(r => `${r.item_type}|${r.item_key}`));

  const itemReviewApi: ItemReviewApi = {
    isApproved: (itemType, itemKey) => {
      const k = `${itemType}|${itemKey}`;
      return k in approvalOverrides ? approvalOverrides[k] : serverApprovedKeys.has(k);
    },
    toggle: (itemType, itemKey) => {
      const k = `${itemType}|${itemKey}`;
      const current = k in approvalOverrides ? approvalOverrides[k] : serverApprovedKeys.has(k);
      const next = !current;
      setApprovalOverrides(prev => ({ ...prev, [k]: next }));
      fetch("/api/dashboard/gl-item-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: currentData.location, month: currentData.month, item_type: itemType, item_key: itemKey, approved: next }),
      }).then(resp => {
        if (!resp.ok) {
          // Revert on failure — never leave the UI claiming a state the
          // server didn't actually persist.
          setApprovalOverrides(prev => ({ ...prev, [k]: current }));
        }
      }).catch(() => {
        setApprovalOverrides(prev => ({ ...prev, [k]: current }));
      });
    },
  };

  // Same optimistic-override pattern as approvalOverrides above, keyed the
  // same way. Server notes are the fallback; a local save wins until the
  // next full page load.
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({});
  const serverNotes = new Map(itemNotes.map(n => [`${n.item_type}|${n.item_key}`, n.note]));

  const notesApi: ItemNoteApi = {
    getNote: (itemType, itemKey) => {
      const k = `${itemType}|${itemKey}`;
      return k in noteOverrides ? noteOverrides[k] : (serverNotes.get(k) ?? "");
    },
    saveNote: (itemType, itemKey, note) => {
      const k = `${itemType}|${itemKey}`;
      const previous = k in noteOverrides ? noteOverrides[k] : (serverNotes.get(k) ?? "");
      setNoteOverrides(prev => ({ ...prev, [k]: note }));
      fetch("/api/dashboard/gl-item-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: currentData.location, month: currentData.month, item_type: itemType, item_key: itemKey, note }),
      }).then(resp => {
        if (!resp.ok) {
          setNoteOverrides(prev => ({ ...prev, [k]: previous }));
        }
      }).catch(() => {
        setNoteOverrides(prev => ({ ...prev, [k]: previous }));
      });
    },
  };

  const flags = currentData.variance_flags ?? [];
  const violations = currentData.control_violations ?? [];
  const jeAccounts = currentData.journal_entry_accounts ?? [];

  const unapprovedCount = (itemType: ItemType, keys: string[]) =>
    keys.filter(k => !itemReviewApi.isApproved(itemType, k)).length;

  const flagKeys = flags.map(f => f.account);
  const violationKeys = violations.map(v => `${v.account}|${v.control}|${v.amount}`);
  const jeKeys = jeAccounts.map(a => a.account);

  const flagCount = unapprovedCount("variance", flagKeys);
  const violationCount = unapprovedCount("control", violationKeys);
  const jeCount = unapprovedCount("je", jeKeys);
  const totalIssues = flagCount + violationCount + jeCount;

  const statusColor =
    localReviewed ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : totalIssues === 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : totalIssues <= 5 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200";

  const statusLabel =
    localReviewed ? "Reviewed"
    : totalIssues === 0 ? "Clean"
    : `${totalIssues} item${totalIssues !== 1 ? "s" : ""} to review`;

  async function toggleReviewed() {
    const next = !localReviewed;
    setPending(true);
    try {
      const resp = await fetch("/api/dashboard/gl-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: currentData.location, month: currentData.month, reviewed: next }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        alert(`Couldn't update review status: ${body.error ?? resp.statusText}`);
        return;
      }
      setLocalReviewed(next);
      setLocalReviewedBy(next ? "you" : null);
      setLocalReviewedAt(next ? new Date().toISOString() : null);
      onReviewChange?.(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">GL Verification</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {currentData.month} vs {priorMonth} — last checked {fmtDate(uploadedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
            {statusLabel}
          </span>
          <button
            onClick={toggleReviewed}
            disabled={pending}
            className={[
              "text-xs font-medium px-3 py-1 rounded border transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-wait",
              localReviewed
                ? "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
                : "border-[#F15B27]/40 bg-[#fdf2e9] text-[#F15B27] hover:bg-[#fbe3ce]",
            ].join(" ")}
          >
            {localReviewed ? "Mark unreviewed" : "Mark reviewed"}
          </button>
        </div>
      </div>

      {/* Reviewed banner — doesn't hide the underlying data, just acknowledges it was looked at */}
      {localReviewed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span className="text-xs text-emerald-600">
            Reviewed{localReviewedBy ? ` by ${localReviewedBy}` : ""}{localReviewedAt ? ` on ${fmtDate(localReviewedAt)}` : ""} — flags stay visible below, this just clears the alert badge.
          </span>
        </div>
      )}

      {/* Stat chips — three distinct checks, each answers a different question.
          Counts reflect items still awaiting review — approving an item
          (see itemReviewApi below) drops it from these counts, so the
          headline number tracks real remaining work. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${flagCount === 0 ? "text-emerald-600" : "text-amber-700"}`}>
            {flagCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Variance Flags</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${violationCount === 0 ? "text-emerald-600" : "text-red-600"}`}>
            {violationCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Control # Issues</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${jeCount === 0 ? "text-emerald-600" : "text-amber-700"}`}>
            {jeCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Needs JE Review</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{currentData.month}</p>
          <p className="text-xs text-gray-400 mt-0.5">Current Period vs {priorMonth}</p>
        </div>
      </div>

      {/* Reconciliation notes if any */}
      {currentData.reconciliation_notes?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Reconciliation Notes</p>
          {currentData.reconciliation_notes.map((note, i) => (
            <p key={i} className="text-xs text-amber-700">{note}</p>
          ))}
        </div>
      )}

      {/* Three checks, each answering a different question */}
      <GLVariancePanel flags={flags} priorMonth={priorMonth} reviewApi={itemReviewApi} notesApi={notesApi} />
      <ControlViolationsPanel violations={violations} reviewApi={itemReviewApi} notesApi={notesApi} />
      <JournalEntryPanel accounts={jeAccounts} reviewApi={itemReviewApi} notesApi={notesApi} />
    </div>
  );
}
