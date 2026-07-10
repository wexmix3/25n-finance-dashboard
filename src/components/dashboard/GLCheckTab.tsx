"use client";

import { useState } from "react";
import type { FinancialData } from "@/types/dashboard";
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
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function GLCheckTab({ currentData, priorMonth, uploadedAt, reviewed, reviewedBy, reviewedAt, onReviewChange }: Props) {
  const [pending, setPending] = useState(false);
  const [localReviewed, setLocalReviewed] = useState(reviewed ?? false);
  const [localReviewedBy, setLocalReviewedBy] = useState(reviewedBy ?? null);
  const [localReviewedAt, setLocalReviewedAt] = useState(reviewedAt ?? null);

  const flags = currentData.variance_flags ?? [];
  const violations = currentData.control_violations ?? [];
  const jeAccounts = currentData.journal_entry_accounts ?? [];
  const flagCount = flags.length;
  const totalIssues = flagCount + violations.length + jeAccounts.length;

  const statusColor =
    localReviewed ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : totalIssues === 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : totalIssues <= 5 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-700 bg-red-50 border-red-200";

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
                : "border-[#E07A3E]/40 bg-[#fdf2e9] text-[#E07A3E] hover:bg-[#fbe3ce]",
            ].join(" ")}
          >
            {localReviewed ? "Mark unreviewed" : "Mark reviewed"}
          </button>
        </div>
      </div>

      {/* Reviewed banner — doesn't hide the underlying data, just acknowledges it was looked at */}
      {localReviewed && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span className="text-xs text-emerald-800">
            Reviewed{localReviewedBy ? ` by ${localReviewedBy}` : ""}{localReviewedAt ? ` on ${fmtDate(localReviewedAt)}` : ""} — flags stay visible below, this just clears the alert badge.
          </span>
        </div>
      )}

      {/* Stat chips — three distinct checks, each answers a different question.
          Flat, borderless tiles (not the bordered white "container" cards
          used for the tables below) so the headline counts and the detailed
          data don't compete for the same visual weight. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${flagCount === 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {flagCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Variance Flags</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${violations.length === 0 ? "text-emerald-600" : "text-red-600"}`}>
            {violations.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Control # Issues</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${jeAccounts.length === 0 ? "text-emerald-600" : "text-amber-700"}`}>
            {jeAccounts.length}
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
      <GLVariancePanel flags={flags} priorMonth={priorMonth} />
      <ControlViolationsPanel violations={violations} />
      <JournalEntryPanel accounts={jeAccounts} />

      {/* Re-run instructions */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
        <p className="text-xs font-medium text-gray-600 mb-1">Re-run GL Check</p>
        <code className="text-xs text-gray-500 font-mono block">
          python scripts/month-close/push_to_dashboard.py --location {currentData.location} --month &quot;{currentData.month}&quot; --variances
        </code>
      </div>
    </div>
  );
}
