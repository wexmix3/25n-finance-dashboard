"use client";

import { useState } from "react";
import type { FinancialData, VarianceFlag } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";

// ── Section-level flags (computed from P&L sections) ──────────────────────────

interface SectionFlag {
  label: string;
  current: number;
  prior: number;
  variance: number;
  pct: number | null;
  isRevenue: boolean;
}

// A tiny prior-period value can turn a modest dollar swing into a
// meaningless percentage (e.g. Utilities $47 -> $2,256 reads as +4721.1%,
// caught in Round 3 UX audit 2026-08-19) — cap what's shown as a %, the
// dollar change (already displayed alongside it) carries the real signal
// once the ratio stops being informative.
const PCT_SANITY_CAP = 300;

function shouldFlag(current: number, prior: number): boolean {
  const variance = Math.abs(current - prior);
  if (prior === 0) return Math.abs(current) > 500;
  if (Math.abs(prior) > 1000) return variance > Math.max(500, Math.abs(prior) * 0.2);
  return variance > 500;
}

function buildSectionFlags(current: FinancialData, prior: FinancialData): SectionFlag[] {
  const is = current.income_statement;
  const ip = prior.income_statement;

  const sections: { label: string; curr: number; prev: number; isRevenue: boolean }[] = [
    { label: "Total Revenue",       curr: is.revenue._total.actual,            prev: ip.revenue._total.actual,            isRevenue: true },
    { label: "Membership",          curr: is.revenue.membership.actual,        prev: ip.revenue.membership.actual,        isRevenue: true },
    { label: "Registration & Access", curr: is.revenue.registration_access.actual, prev: ip.revenue.registration_access.actual, isRevenue: true },
    { label: "Workspace Rental",    curr: is.revenue.workspace_rental.actual,  prev: ip.revenue.workspace_rental.actual,  isRevenue: true },
    { label: "Meeting Space",       curr: is.revenue.meeting_space.actual,     prev: ip.revenue.meeting_space.actual,     isRevenue: true },
    { label: "Package Revenue",     curr: is.revenue.package_revenue.actual,   prev: ip.revenue.package_revenue.actual,   isRevenue: true },
    { label: "Member Amenities",    curr: is.revenue.member_amenities.actual,  prev: ip.revenue.member_amenities.actual,  isRevenue: true },
    { label: "Total COS",           curr: is.cos._total.actual,                prev: ip.cos._total.actual,                isRevenue: false },
    { label: "Gross Profit",        curr: is.gross_profit.actual,              prev: ip.gross_profit.actual,              isRevenue: true },
    { label: "Payroll",             curr: is.opex.payroll.actual,              prev: ip.opex.payroll.actual,              isRevenue: false },
    { label: "Facilities",          curr: is.opex.facilities.actual,           prev: ip.opex.facilities.actual,           isRevenue: false },
    { label: "Insurance",           curr: is.opex.insurance.actual,            prev: ip.opex.insurance.actual,            isRevenue: false },
    { label: "Marketing",           curr: is.opex.marketing.actual,            prev: ip.opex.marketing.actual,            isRevenue: false },
    { label: "Technology",          curr: is.opex.technology.actual,           prev: ip.opex.technology.actual,           isRevenue: false },
    { label: "Utilities",           curr: is.opex.utilities.actual,            prev: ip.opex.utilities.actual,            isRevenue: false },
    { label: "Admin / Legal",       curr: is.opex.admin_legal.actual,          prev: ip.opex.admin_legal.actual,          isRevenue: false },
    { label: "Total OPEX",          curr: is.opex._total.actual,               prev: ip.opex._total.actual,               isRevenue: false },
    { label: "Net Op. Income",      curr: is.net_operating_income.actual,      prev: ip.net_operating_income.actual,      isRevenue: true },
  ];

  return sections
    .filter((s) => shouldFlag(s.curr, s.prev))
    .map((s) => {
      const variance = s.curr - s.prev;
      const rawPct = s.prev !== 0 ? (variance / Math.abs(s.prev)) * 100 : null;
      // NaN is a deliberate sentinel here, distinct from null ("new" — no
      // prior to compare against): it means a prior existed but was too
      // small to keep the ratio meaningful, so fmtPct renders it "n/a"
      // instead of the misleading "new".
      const pct = rawPct === null ? null : Math.abs(rawPct) <= PCT_SANITY_CAP ? Math.round(rawPct * 10) / 10 : NaN;
      return { label: s.label, current: s.curr, prior: s.prev, variance, pct, isRevenue: s.isRevenue };
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtK(v: number): string {
  return formatCurrency(v, { compact: true, zeroDash: false });
}

function fmtPct(v: number | null): string {
  if (v === null) return "new";
  if (Number.isNaN(v)) return "n/a";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  current: FinancialData | null;
  prior: FinancialData | null;
  glFlags?: VarianceFlag[];
  priorMonth: string;
  pacingPct?: number | null;
  /** Skip the outer card chrome (border/rounding) — for nesting inside a shared container. */
  bare?: boolean;
}

export function VariancePanel({ current, prior, glFlags = [], priorMonth, pacingPct, bare }: Props) {
  const [showAccountDetail, setShowAccountDetail] = useState(false);

  if (!current || !prior) {
    return (
      <div className={bare ? "" : "bg-white rounded-lg border border-gray-200 p-4"}>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Variance Analysis</h3>
        <p className="text-sm text-gray-400">Prior period data required for variance analysis.</p>
      </div>
    );
  }

  // Suppress P&L section variance flags when <50% through the month — too many false alarms
  const isTooEarly = pacingPct !== null && pacingPct !== undefined && pacingPct < 0.5;
  const sectionFlags = isTooEarly ? [] : buildSectionFlags(current, prior);
  const totalFlags = sectionFlags.length + glFlags.length;

  return (
    <div className={bare ? "" : "bg-white rounded-lg border border-gray-200"}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Variance Analysis</h3>
          <p className="text-xs text-gray-400 mt-0.5">vs {priorMonth} — {totalFlags} flag{totalFlags !== 1 ? "s" : ""}</p>
        </div>
        {totalFlags === 0 && !isTooEarly && (
          <span className="text-xs text-emerald-600 font-semibold">All clean</span>
        )}
      </div>

      {isTooEarly && glFlags.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          Section variance analysis available after mid-month ({Math.round((pacingPct ?? 0) * 100)}% through period).
        </div>
      ) : totalFlags === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          No variances exceed thresholds vs {priorMonth}.
        </div>
      ) : (
        <>
          {/* Section-level flags */}
          {sectionFlags.length > 0 && (
            <div className="overflow-x-auto">
              <div className="px-4 pt-3 pb-1 flex items-start justify-between gap-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Line Items to Review ({sectionFlags.length})</p>
                <p className="text-xs text-gray-400 italic text-right flex-shrink-0">MTD actuals vs prior full month</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Section</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Prior</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Current</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Change</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sectionFlags.map((f) => {
                    const unfav = f.isRevenue ? f.variance < 0 : f.variance > 0;
                    return (
                      <tr key={f.label} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700 font-medium">{f.label}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{fmtK(f.prior)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{fmtK(f.current)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                          {f.variance > 0 ? "+" : ""}{fmtK(f.variance)}
                        </td>
                        <td className={`px-4 py-2 text-right ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                          {fmtPct(f.pct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Account-level detail (collapsible) */}
          {glFlags.length > 0 && (
            <div className="border-t border-gray-100">
              <button
                onClick={() => setShowAccountDetail(!showAccountDetail)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
              >
                <span className="uppercase tracking-wider">Account Detail ({glFlags.length} accounts)</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${showAccountDetail ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showAccountDetail && (
                <div className="border-t border-gray-100">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-600">Flag rule:</span>{" "}
                      prior $0 → flag if current exceeds $500 (new activity) · prior over $1,000 → flag if change
                      exceeds the larger of $500 or 20% of prior · prior $1–$1,000 → flag if change exceeds $500.
                      Listed oldest-to-newest by account code.
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...glFlags]
                        .sort((a, b) => a.account.localeCompare(b.account))
                        .map((f) => {
                          const isRev = f.account.startsWith("4") || f.account.startsWith("9");
                          const unfav = isRev ? f.variance < 0 : f.variance > 0;
                          return (
                            <tr key={f.account} className="hover:bg-gray-50">
                              <td className="px-4 py-1.5 text-gray-400 font-mono">{f.account}</td>
                              <td className="px-4 py-1.5 text-gray-700 max-w-[200px] truncate">{f.name}</td>
                              <td className="px-4 py-1.5 text-right text-gray-500">{fmtK(f.prior)}</td>
                              <td className="px-4 py-1.5 text-right text-gray-700">{fmtK(f.current)}</td>
                              <td className={`px-4 py-1.5 text-right font-semibold ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                                {f.variance > 0 ? "+" : ""}{fmtK(f.variance)}
                              </td>
                              <td className={`px-4 py-1.5 text-right ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                                {f.variance_pct !== null ? fmtPct(f.variance_pct) : "new"}
                              </td>
                              <td className="px-4 py-1.5 text-gray-400 whitespace-nowrap">{f.rule_triggered}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
