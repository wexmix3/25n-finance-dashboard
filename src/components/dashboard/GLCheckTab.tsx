"use client";

import type { FinancialData } from "@/types/dashboard";
import { GLVariancePanel } from "./GLVariancePanel";

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
  const flagCount = flags.length;

  // Derive clean count from the ratio in flags vs total accounts (approximate)
  const statusColor =
    flagCount === 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : flagCount <= 5 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-700 bg-red-50 border-red-200";

  const statusLabel =
    flagCount === 0 ? "Clean" : `${flagCount} flag${flagCount !== 1 ? "s" : ""}`;

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

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-bold ${flagCount === 0 ? "text-emerald-600" : "text-red-600"}`}>
            {flagCount}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Variance Flags</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">
            {flagCount === 0 ? "—" : priorMonth}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Compared Against</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{currentData.month}</p>
          <p className="text-xs text-gray-400 mt-0.5">Current Period</p>
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

      {/* Variance flags table */}
      <GLVariancePanel flags={flags} priorMonth={priorMonth} />

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
