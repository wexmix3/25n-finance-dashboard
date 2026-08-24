"use client";

import React, { useState } from "react";
import type { ControlViolation } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import { ItemApproveButton } from "./ItemApproveButton";
import { ApproveAllButton } from "./ApproveAllButton";
import { ItemNoteButton } from "./ItemNoteButton";
import { ItemNoteRow } from "./ItemNoteRow";
import type { ItemReviewApi, ItemNoteApi } from "./GLCheckTab";

const PAGE_SIZE = 25;

interface Props {
  violations: ControlViolation[];
  reviewApi: ItemReviewApi;
  notesApi: ItemNoteApi;
}

function violationKey(v: ControlViolation): string {
  return `${v.account}|${v.control}|${v.amount}`;
}

function fmtK(v: number): string {
  return formatCurrency(v, { compact: true, zeroDash: false });
}

// The upstream parser (parse_general_ledger.py) writes messages like
// "expected one of: ['P', 'K', 'J', 'R']" — a Python list repr, not copy a
// person should read. Humanize display-side rather than reprocessing every
// stored record: strips brackets/quotes down to "expected one of: P, K, J, R".
function humanizeMessage(msg: string): string {
  return msg.replace(
    /\[\s*((?:'[^']*'|"[^"]*")(?:\s*,\s*(?:'[^']*'|"[^"]*"))*)\s*\]/g,
    (_, inner: string) => (inner.match(/'[^']*'|"[^"]*"/g) ?? []).map(s => s.slice(1, -1)).join(", ")
  );
}

// Fallback only — every real violation already carries its own specific
// `message` (e.g. "expected one of: ['P','K','J','R']"), computed by
// parse_general_ledger.py. Round 3 UX audit (2026-08-19) caught the table
// rendering this generic label for every row instead, discarding the
// specific reason that was already sitting in the data.
const ISSUE_LABEL_FALLBACK: Record<string, string> = {
  wrong_control_prefix: "Unexpected control # prefix for this account",
  wrong_vendor: "Vendor on transaction doesn't match vendor of record",
  inactive_account_has_activity: "Inactive account has activity",
};

export function ControlViolationsPanel({ violations, reviewApi, notesApi }: Props) {
  // Hooks must run unconditionally — the empty-state early return comes after.
  const [showAll, setShowAll] = useState(false);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);

  if (violations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Control # &amp; Vendor Issues</h3>
        <p className="text-sm text-gray-400">No control # or vendor mismatches — every transaction ties out correctly.</p>
      </div>
    );
  }

  // Biggest-dollar issues first — with 214 transaction-level rows possible
  // (Schaumburg, Jul 2026), account-code order buried the issues worth
  // looking at first under alphabetical noise.
  const sorted = [...violations].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Control # &amp; Vendor Issues</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {violations.length} transaction{violations.length !== 1 ? "s" : ""} — answers &ldquo;are the account #s correct&rdquo;
          </p>
        </div>
        <ApproveAllButton itemType="control" keys={sorted.map(violationKey)} reviewApi={reviewApi} />
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] text-gray-500">
          Every posted transaction should carry a Control # prefix appropriate for its account section
          (R = recurring/rent, K = cash disbursement, C = charge/revenue, J = journal entry, P = purchase/vendor payment).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide w-16">Acct</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Description</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Control #</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Amount</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Issue</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.map((v, i) => {
              const key = violationKey(v);
              const rowId = `${key}-${i}`;
              const approved = reviewApi.isApproved("control", key);
              return (
                <React.Fragment key={rowId}>
                  <tr className={`hover:bg-gray-50 ${approved ? "opacity-50" : ""}`}>
                    <td className="px-4 py-1.5 text-gray-400 font-mono">{v.account}</td>
                    <td className="px-4 py-1.5 text-gray-700 max-w-[160px] truncate">{v.account_name}</td>
                    <td className="px-4 py-1.5 text-gray-500 font-mono">{v.control}</td>
                    <td className="px-4 py-1.5 text-right text-gray-700">{fmtK(v.amount)}</td>
                    <td className={`px-4 py-1.5 ${approved ? "text-gray-500" : "text-red-600"}`}>{humanizeMessage(v.message || ISSUE_LABEL_FALLBACK[v.violation_type] || v.violation_type)}</td>
                    <td className="px-4 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ItemNoteButton
                          itemType="control"
                          itemKey={key}
                          notesApi={notesApi}
                          isOpen={noteOpen === rowId}
                          onToggle={() => setNoteOpen(noteOpen === rowId ? null : rowId)}
                        />
                        <ItemApproveButton itemType="control" itemKey={key} reviewApi={reviewApi} />
                      </div>
                    </td>
                  </tr>
                  {noteOpen === rowId && (
                    <ItemNoteRow itemType="control" itemKey={key} notesApi={notesApi} colSpan={6} />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors duration-150 cursor-pointer"
        >
          Show {hiddenCount} more (sorted by $ amount)
        </button>
      )}
    </div>
  );
}
