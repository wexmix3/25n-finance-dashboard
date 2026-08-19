"use client";

import React, { useState } from "react";
import type { JournalEntryAccount } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";

interface Props {
  accounts: JournalEntryAccount[];
}

function fmtK(v: number): string {
  return formatCurrency(v, { compact: true, zeroDash: false });
}

export function JournalEntryPanel({ accounts }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Journal Entry Review Required</h3>
        <p className="text-sm text-gray-400">No journal entries posted this period.</p>
      </div>
    );
  }

  const sorted = [...accounts].sort((a, b) => a.account.localeCompare(b.account));

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Journal Entry Review Required</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {accounts.length} account{accounts.length !== 1 ? "s" : ""} — flagged regardless of variance threshold
        </p>
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] text-gray-500">
          A journal entry means a human made a manual adjustment — needs independent review even if the account&apos;s
          MoM variance didn&apos;t breach the threshold.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide w-16">Acct</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Description</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide"># Entries</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Net Amount</th>
              <th className="px-4 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((e) => {
              const isOpen = expanded === e.account;
              return (
                <React.Fragment key={e.account}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : e.account)}
                  >
                    <td className="px-4 py-1.5 text-gray-400 font-mono">{e.account}</td>
                    <td className="px-4 py-1.5 text-gray-700 max-w-[200px] truncate">{e.account_name}</td>
                    <td className="px-4 py-1.5 text-right text-amber-700 font-semibold">{e.transaction_count}</td>
                    <td className="px-4 py-1.5 text-right text-gray-700">{fmtK(e.total_amount)}</td>
                    <td className="px-4 py-1.5 text-right text-gray-400">
                      <svg className={`w-3 h-3 inline-block transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${e.account}-detail`}>
                      <td colSpan={5} className="px-4 py-2 bg-gray-50">
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
                            {e.transactions.map((t, i) => (
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
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
