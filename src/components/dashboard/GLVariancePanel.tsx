"use client";

import React, { useState } from "react";
import type { VarianceFlag } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import { ItemApproveButton } from "./ItemApproveButton";
import { ApproveAllButton } from "./ApproveAllButton";
import { ItemNoteButton } from "./ItemNoteButton";
import { ItemNoteRow } from "./ItemNoteRow";
import type { ItemReviewApi, ItemNoteApi } from "./GLCheckTab";

interface Props {
  flags: VarianceFlag[];
  priorMonth: string;
  reviewApi: ItemReviewApi;
  notesApi: ItemNoteApi;
}

function fmtK(v: number): string {
  return formatCurrency(v, { compact: true, zeroDash: false });
}

function fmtPct(v: number | null): string {
  if (v === null) return "new";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// Revenue accounts (4xxx) and GP/NOI — unfavorable when they go down
function isRevenueAccount(account: string): boolean {
  return account.startsWith("4") || account.startsWith("9");
}

export function GLVariancePanel({ flags, priorMonth, reviewApi, notesApi }: Props) {
  // Hooks must run unconditionally — the empty-state early return comes after.
  const [expanded, setExpanded] = useState<string | null>(null);
  // Separate from `expanded` (transaction detail) on purpose — a reviewer
  // should be able to read the note and the transaction breakdown at the
  // same time instead of one collapsing the other.
  const [noteOpen, setNoteOpen] = useState<string | null>(null);

  if (flags.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">GL Variance Detail</h3>
        <p className="text-sm text-gray-400">No account-level flags — all clean vs {priorMonth}.</p>
      </div>
    );
  }

  // Chronological by account code (4xxx revenue before 6xxx/7xxx OPEX), not by variance size —
  // reads the way the chart of accounts does.
  const sorted = [...flags].sort((a, b) => a.account.localeCompare(b.account));

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">GL Variance Detail</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            vs {priorMonth} — {flags.length} account{flags.length !== 1 ? "s" : ""} flagged
          </p>
        </div>
        <ApproveAllButton itemType="variance" keys={sorted.map(f => f.account)} reviewApi={reviewApi} />
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] text-gray-500">
          <span className="font-semibold text-gray-600">Flag rule:</span>{" "}
          Revenue accounts flag if change exceeds $1,000 · COS/OPEX accounts flag if change exceeds $500 ·
          everything else (balance sheet, other income/expense, unmapped codes): prior $0 → flag if current
          exceeds $500 (new activity) · prior over $1,000 → flag if change exceeds the larger of $500 or 20% of
          prior · prior $1–$1,000 → flag if change exceeds $500.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide w-16">Acct</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Description</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Prior</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Current</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Change</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">%</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Why flagged</th>
              <th className="px-4 py-2 w-24" />
              <th className="px-4 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((f) => {
              const unfav = isRevenueAccount(f.account) ? f.variance < 0 : f.variance > 0;
              const isOpen = expanded === f.account;
              const hasDetail = (f.transactions?.length ?? 0) > 0;
              const approved = reviewApi.isApproved("variance", f.account);
              return (
                <React.Fragment key={f.account}>
                  <tr
                    className={`hover:bg-gray-50 ${hasDetail ? "cursor-pointer" : ""} ${approved ? "opacity-50" : ""}`}
                    onClick={() => hasDetail && setExpanded(isOpen ? null : f.account)}
                  >
                    <td className="px-4 py-1.5 text-gray-400 font-mono">{f.account}</td>
                    <td className="px-4 py-1.5 text-gray-700 max-w-[200px] truncate">{f.name}</td>
                    <td className="px-4 py-1.5 text-right text-gray-500">{fmtK(f.prior)}</td>
                    <td className="px-4 py-1.5 text-right text-gray-700">{fmtK(f.current)}</td>
                    <td className={`px-4 py-1.5 text-right font-medium ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                      {f.variance > 0 ? "+" : ""}{fmtK(f.variance)}
                    </td>
                    <td className={`px-4 py-1.5 text-right ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                      {fmtPct(f.variance_pct)}
                    </td>
                    <td className="px-4 py-1.5 text-gray-400 whitespace-nowrap">{f.rule_triggered}</td>
                    <td className="px-4 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ItemNoteButton
                          itemType="variance"
                          itemKey={f.account}
                          notesApi={notesApi}
                          isOpen={noteOpen === f.account}
                          onToggle={() => setNoteOpen(noteOpen === f.account ? null : f.account)}
                        />
                        <ItemApproveButton itemType="variance" itemKey={f.account} reviewApi={reviewApi} />
                      </div>
                    </td>
                    <td className="px-4 py-1.5 text-right text-gray-400">
                      {hasDetail && (
                        <svg className={`w-3 h-3 inline-block transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      )}
                    </td>
                  </tr>
                  {isOpen && hasDetail && (
                    <tr key={`${f.account}-detail`}>
                      <td colSpan={9} className="px-4 py-2 bg-gray-50">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="text-left font-medium py-1 pr-3">Date</th>
                              <th className="text-left font-medium py-1 pr-3">Control #</th>
                              <th className="text-left font-medium py-1 pr-3">Description</th>
                              <th className="text-right font-medium py-1">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.transactions!.map((t, i) => (
                              <tr key={i} className="text-gray-600">
                                <td className="py-1 pr-3">{t.date}</td>
                                <td className="py-1 pr-3 font-mono">{t.control}</td>
                                <td className="py-1 pr-3 truncate max-w-[240px]">{t.person_description || "—"}</td>
                                <td className="py-1 text-right">{fmtK(t.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                  {noteOpen === f.account && (
                    <ItemNoteRow itemType="variance" itemKey={f.account} notesApi={notesApi} colSpan={9} />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
