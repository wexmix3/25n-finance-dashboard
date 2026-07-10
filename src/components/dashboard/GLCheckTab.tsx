"use client";

import type { FinancialData } from "@/types/dashboard";
import { GLVariancePanel } from "./GLVariancePanel";
import { ControlViolationsPanel } from "./ControlViolationsPanel";
import { JournalEntryPanel } from "./JournalEntryPanel";

interface Props {
  currentData: FinancialData;
  priorMonth: string;
  uploadedAt?: string;
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function GLCheckTab({ currentData, priorMonth, uploadedAt }: Props) {
  const flags = currentData.variance_flags ?? [];
  const violations = currentData.control_violations ?? [];
  const jeAccounts = currentData.journal_entry_accounts ?? [];
  const flagCount = flags.length;
  const totalIssues = flagCount + violations.length + jeAccounts.length;

  const statusColor =
    totalIssues === 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : totalIssues <= 5 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-700 bg-red-50 border-red-200";

  const statusLabel =
    totalIssues === 0 ? "Clean" : `${totalIssues} item${totalIssues !== 1 ? "s" : ""} to review`;

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
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Stat chips — three distinct checks, each answers a different question */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-bold ${flagCount === 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {flagCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Variance Flags</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-bold ${violations.length === 0 ? "text-emerald-600" : "text-red-600"}`}>
            {violations.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Control # Issues</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-bold ${jeAccounts.length === 0 ? "text-emerald-600" : "text-amber-700"}`}>
            {jeAccounts.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Needs JE Review</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
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
