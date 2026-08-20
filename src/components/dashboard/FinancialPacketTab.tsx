"use client";

import { useState } from "react";
import type { FinancialData, MonthlyPacket } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import { AlertBanner } from "@/components/dashboard/AlertBanner";

interface Props {
  currentData: FinancialData;
  packet: MonthlyPacket | null;
}

function fmt$(n: number): string {
  return formatCurrency(n, { zeroDash: false });
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

interface ISRowProps {
  label: string;
  actual: number;
  budget?: number;
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
  keyLine?: boolean; // NOI / Net Income — gets orange accent
}

function ISRow({ label, actual, budget, indent, bold, separator, keyLine }: ISRowProps) {
  const isNegative = actual < 0;
  const rowClass = [
    "hover:bg-gray-50 transition-colors",
    separator ? "border-t-2 border-gray-200" : "border-t border-gray-100",
    keyLine ? "bg-gray-50 border-l-2 border-l-[#F15B27]" : "",
    bold && !keyLine ? "bg-gray-50/60" : "",
  ].filter(Boolean).join(" ");

  const labelClass = [
    "px-4 text-xs",
    keyLine ? "py-3 font-bold text-gray-900" : bold ? "py-2 font-semibold text-gray-800" : "py-2 text-gray-600",
    indent ? "pl-8" : "",
  ].filter(Boolean).join(" ");

  const numClass = [
    "px-4 text-xs text-right tabular-nums",
    keyLine ? "py-3 font-bold" : bold ? "py-2 font-semibold" : "py-2",
  ].filter(Boolean).join(" ");

  return (
    <tr className={rowClass}>
      <td className={labelClass}>{label}</td>
      <td className={`${numClass} ${isNegative ? "text-red-600" : keyLine ? "text-gray-900" : "text-gray-800"}`}>
        {fmt$(actual)}
      </td>
      <td className={`${numClass} text-gray-400`}>
        {budget !== undefined ? fmt$(budget) : "—"}
      </td>
    </tr>
  );
}

function PlaceholderSection({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{reason}</p>
    </div>
  );
}

function AgingTable({ label, totals }: { label: string; totals: Record<string, number> }) {
  // "Current" is excluded from both tables — it isn't an independent bucket,
  // Yardi always mirrors it into whichever real bucket (0-30/31-60/etc.)
  // currently holds the balance (same non-additive behavior fixed in
  // parse_ar_aging.py / parse_ap_aging.py's own total_owed calc), so it adds
  // no new information and previously made AR (5 rows) and AP (4 rows) not
  // line up when shown side by side.
  const buckets = [
    { key: "d0_30", label: "0–30 days" },
    { key: "d31_60", label: "31–60 days" },
    { key: "d61_90", label: "61–90 days" },
    { key: "over_90", label: "Over 90" },
  ];
  // Sub-$10 amounts in an aging bucket are rounding/reconciliation dust, not
  // a real balance — showing e.g. "($4)" in a client-facing packet reads as
  // sloppy bookkeeping rather than the immaterial noise it actually is.
  const DUST_FLOOR = 10;
  const clean = (v: number) => (Math.abs(v) < DUST_FLOOR ? 0 : v);
  const lateCount = buckets.filter(b => clean(totals[b.key] ?? 0) !== 0).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{label}</h3>
        {/* Same pill-badge treatment as GL Check's status pill — small
            rounded status chip instead of relying on red text alone. */}
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
          lateCount === 0
            ? "text-emerald-600 bg-emerald-50 border-emerald-200"
            : "text-red-600 bg-red-50 border-red-200"
        }`}>
          {lateCount === 0 ? "Current" : `${lateCount} bucket${lateCount !== 1 ? "s" : ""} past due`}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Bucket</th>
            <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {buckets.map(b => {
            const amount = clean(totals[b.key] ?? 0);
            const isLate = b.key !== "current" && b.key !== "d0_30" && amount !== 0;
            return (
              <tr key={b.key} className="hover:bg-gray-50 transition-colors">
                <td className={`px-5 py-2.5 text-xs ${isLate ? "font-medium text-red-600" : "text-gray-700"}`}>{b.label}</td>
                <td className={`px-5 py-2.5 text-right text-xs tabular-nums ${isLate ? "text-red-600 font-medium" : "text-gray-700"}`}>
                  {fmt$(amount)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="px-5 py-3 text-xs font-bold text-gray-900">Total</td>
            <td className="px-5 py-3 text-right text-xs font-bold text-gray-900 tabular-nums">{fmt$(totals.total_owed ?? 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function FinancialPacketTab({ currentData, packet }: Props) {
  const is = currentData.income_statement;
  const hasPacket = packet !== null;
  const packetData = packet?.data;
  const [pdfError, setPdfError] = useState(false);

  async function handleGeneratePdf() {
    if (!packetData) return;
    setPdfError(false);
    const resp = await fetch("/api/dashboard/generate-packet-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packetData),
    });
    if (!resp.ok) {
      setPdfError(true);
      return;
    }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `25N-${currentData.location}-${currentData.month.replace(" ", "-")}-packet.pdf`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Financial Packet</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {currentData.location} · {currentData.month}
            {packetData && ` · Generated ${new Date(packetData.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
        </div>
        <button
          onClick={handleGeneratePdf}
          disabled={!hasPacket}
          className={[
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors duration-150",
            hasPacket
              ? "bg-[#F15B27] text-white hover:bg-[#c96c34] cursor-pointer"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          ].join(" ")}
          title={!hasPacket ? "Generate the financial packet for this period first" : undefined}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Generate PDF
        </button>
      </div>

      {/* PDF generation failure — inline banner, not a native browser popup */}
      {pdfError && (
        <AlertBanner message="PDF generation failed — please try again, or contact support if this continues." />
      )}

      {/* Completeness banner */}
      {packetData && !packetData.data_complete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span className="text-xs text-amber-700">
            Packet incomplete — missing: {packetData.missing_sources.join(", ")}
          </span>
        </div>
      )}

      {/* Income Statement */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">Income Statement</h3>
          <p className="text-xs text-gray-400 mt-0.5">MTD vs Budget</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-full">Line Item</th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Actual</th>
              <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap pr-5">Budget</th>
            </tr>
          </thead>
          <tbody>
            <ISRow label="Revenue" actual={is.revenue._total.actual} budget={is.revenue._total.budget} bold />
            <ISRow label="Workspace Rental" actual={is.revenue.workspace_rental.actual} budget={is.revenue.workspace_rental.budget} indent />
            <ISRow label="Meeting Space" actual={is.revenue.meeting_space.actual} budget={is.revenue.meeting_space.budget} indent />
            <ISRow label="Package Revenue" actual={is.revenue.package_revenue.actual} budget={is.revenue.package_revenue.budget} indent />
            <ISRow label="Member Amenities" actual={is.revenue.member_amenities.actual} budget={is.revenue.member_amenities.budget} indent />
            <ISRow label="Membership" actual={is.revenue.membership.actual} budget={is.revenue.membership.budget} indent />
            <ISRow label="Registration & Access" actual={is.revenue.registration_access.actual} budget={is.revenue.registration_access.budget} indent />
            <ISRow label="Miscellaneous" actual={is.revenue.miscellaneous.actual} budget={is.revenue.miscellaneous.budget} indent />
            <ISRow label="Cost of Sales" actual={is.cos._total.actual} budget={is.cos._total.budget} bold separator />
            <ISRow label="Direct COS" actual={is.cos.direct_cos.actual} budget={is.cos.direct_cos.budget} indent />
            <ISRow label="Community" actual={is.cos.community.actual} budget={is.cos.community.budget} indent />
            <ISRow
              label={`Gross Profit (${fmtPct(is.gross_profit.margin_pct)})`}
              actual={is.gross_profit.actual}
              budget={is.gross_profit.budget}
              bold separator
            />
            <ISRow label="Operating Expenses" actual={is.opex._total.actual} budget={is.opex._total.budget} bold separator />
            <ISRow label="Payroll" actual={is.opex.payroll.actual} budget={is.opex.payroll.budget} indent />
            <ISRow label="Facilities" actual={is.opex.facilities.actual} budget={is.opex.facilities.budget} indent />
            <ISRow label="Insurance" actual={is.opex.insurance.actual} budget={is.opex.insurance.budget} indent />
            <ISRow label="Utilities" actual={is.opex.utilities.actual} budget={is.opex.utilities.budget} indent />
            <ISRow label="Marketing" actual={is.opex.marketing.actual} budget={is.opex.marketing.budget} indent />
            <ISRow label="Meals & Entertainment" actual={is.opex.meals_entertainment.actual} budget={is.opex.meals_entertainment.budget} indent />
            <ISRow label="Office Expense" actual={is.opex.office_supplies.actual} budget={is.opex.office_supplies.budget} indent />
            <ISRow label="Technology" actual={is.opex.technology.actual} budget={is.opex.technology.budget} indent />
            <ISRow label="Travel" actual={is.opex.travel.actual} budget={is.opex.travel.budget} indent />
            <ISRow label="Admin / Legal" actual={is.opex.admin_legal.actual} budget={is.opex.admin_legal.budget} indent />
            <ISRow label="Other OPEX" actual={is.opex.other.actual} budget={is.opex.other.budget} indent />
            <ISRow
              label={`Net Operating Income (${fmtPct(is.net_operating_income.margin_pct)})`}
              actual={is.net_operating_income.actual}
              budget={is.net_operating_income.budget}
              separator keyLine
            />
            <ISRow
              label={`Net Income (${fmtPct(is.net_income.margin_pct)})`}
              actual={is.net_income.actual}
              separator keyLine
            />
          </tbody>
        </table>
      </div>

      {/* Balance Sheet */}
      {packetData?.balance_sheet && !packetData.balance_sheet.error ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Balance Sheet</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-full">Category</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Cash & Bank", key: "cash_and_bank" },
                { label: "Receivables", key: "receivables" },
                { label: "Prepaid & Other", key: "prepaid_and_other" },
                { label: "Fixed Assets", key: "fixed_assets" },
                { label: "Other Assets", key: "other_assets" },
              ].map(({ label, key }) => (
                <tr key={key} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 pl-8 py-2.5 text-xs text-gray-600">{label}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-800 tabular-nums">{fmt$(packetData.balance_sheet.summary[key as keyof typeof packetData.balance_sheet.summary] as number)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-5 py-3 text-xs font-bold text-gray-900">Total Assets</td>
                <td className="px-5 py-3 text-right text-xs font-bold text-gray-900 tabular-nums">{fmt$(packetData.balance_sheet.summary.total_assets)}</td>
              </tr>
              {[
                { label: "Current Liabilities", key: "current_liabilities" },
                { label: "Long-term Liabilities", key: "long_term_liabilities" },
                { label: "Equity", key: "equity" },
              ].map(({ label, key }) => (
                <tr key={key} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 pl-8 py-2.5 text-xs text-gray-600">{label}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-800 tabular-nums">{fmt$(packetData.balance_sheet.summary[key as keyof typeof packetData.balance_sheet.summary] as number)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-5 py-3 text-xs font-bold text-gray-900">Total Liabilities + Equity</td>
                <td className="px-5 py-3 text-right text-xs font-bold text-gray-900 tabular-nums">{fmt$(packetData.balance_sheet.summary.total_liabilities_and_equity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <PlaceholderSection
          title="Balance Sheet"
          reason="Balance sheet not yet available for this period"
        />
      )}

      {/* Cash Flow */}
      {packetData?.cash_flow && !packetData.cash_flow.error ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Cash Flow</h3>
          </div>
          <table className="w-full">
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-5 py-2.5 text-xs text-gray-600">Beginning Cash — {currentData.month}</td>
                <td className="px-5 py-2.5 text-right text-xs text-gray-800 tabular-nums">{fmt$(packetData.cash_flow.beginning_cash)}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-5 py-2.5 text-xs text-gray-600">Net Cash Flow — {currentData.month}</td>
                <td className="px-5 py-2.5 text-right text-xs text-gray-800 tabular-nums">{fmt$(packetData.cash_flow.net_cash_flow)}</td>
              </tr>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-5 py-3 text-xs font-bold text-gray-900">Ending Cash — {currentData.month}</td>
                <td className="px-5 py-3 text-right text-xs font-bold text-gray-900 tabular-nums">{fmt$(packetData.cash_flow.ending_cash)}</td>
              </tr>
              {packetData.cash_flow.net_cash_flow_ytd !== undefined && (
                <tr className="border-t border-gray-100">
                  <td className="px-5 py-2.5 text-xs text-gray-600">
                    Net Cash Flow — YTD
                    {!packetData.cash_flow.ytd_complete && (
                      // A caveat that reads as a dev disclaimer ("partial —
                      // missing months") doesn't belong inline in a metric
                      // label on the doc that gets PDF'd and sent to
                      // Christine/the CEO. A quiet info glyph with the same
                      // detail on hover keeps the number honest without
                      // making the packet look unfinished.
                      <span
                        className="ml-1.5 inline-flex items-center align-middle text-gray-300 hover:text-gray-500 cursor-help"
                        title="Year-to-date figure is a partial total — one or more months this year are still missing from the record."
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-800 tabular-nums">{fmt$(packetData.cash_flow.net_cash_flow_ytd)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <PlaceholderSection
          title="Cash Flow"
          reason="Cash flow data not yet available for this period"
        />
      )}

      {/* AR / AP Aging — side by side on wide screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {packetData?.ar_aging && !packetData.ar_aging.error ? (
          <AgingTable label="AR Aging" totals={packetData.ar_aging.totals as unknown as Record<string, number>} />
        ) : (
          <PlaceholderSection title="AR Aging" reason="Not yet uploaded" />
        )}

        {packetData?.ap_aging && !packetData.ap_aging.error ? (
          <AgingTable
            label="AP Aging"
            totals={packetData.ap_aging.totals as unknown as Record<string, number>}
          />
        ) : (
          <PlaceholderSection title="AP Aging" reason="Not yet uploaded" />
        )}
      </div>

      {/* Two equal-size cards next to each other otherwise hide a real scale
          gap — AP running multiples of AR is a liquidity signal worth
          surfacing, not something two identically-sized boxes should flatten. */}
      {packetData?.ar_aging && !packetData.ar_aging.error && packetData?.ap_aging && !packetData.ap_aging.error && (() => {
        const arTotal = (packetData.ar_aging.totals as unknown as Record<string, number>).total_owed ?? 0;
        const apTotal = (packetData.ap_aging.totals as unknown as Record<string, number>).total_owed ?? 0;
        if (arTotal <= 0 || apTotal <= 0) return null;
        const ratio = apTotal / arTotal;
        if (ratio < 2 && ratio > 0.5) return null;
        const bigger = ratio >= 2 ? "AP" : "AR";
        const multiple = ratio >= 2 ? ratio : 1 / ratio;
        return (
          <p className="text-xs text-gray-400 -mt-1">
            {bigger} is {multiple.toFixed(1)}x {bigger === "AP" ? "AR" : "AP"} this period.
          </p>
        );
      })()}
    </div>
  );
}
