"use client";

import { useState } from "react";
import { FinancialData } from "@/types/dashboard";

function fmtDollar(n: number, acctStyle = true): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n < 0) return acctStyle ? `($${formatted})` : `-$${formatted}`;
  return `$${formatted}`;
}

function fmtVariance(n: number, acctStyle = true): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n > 0) return `+$${formatted}`;
  return acctStyle ? `($${formatted})` : `-$${formatted}`;
}

function fmtRevPct(actual: number | undefined, totalRev: number): string {
  if (actual === undefined || totalRev === 0) return "";
  return `${((actual / totalRev) * 100).toFixed(1)}%`;
}

interface RowProps {
  label: string;
  actual?: number;
  budget?: number;
  prior?: number;
  indent?: boolean;
  bold?: boolean;
  isExpense?: boolean;
  separator?: boolean;
  showRevPct?: boolean;
  totalRev?: number;
  acctStyle?: boolean;
  pacingFactor?: number;
}

// Real <tr>/<td> markup — same technical approach as FinancialPacketTab's
// table, so the two views share one visual language instead of Overview
// reimplementing column alignment/hover/sticky behavior via CSS grid.
function Row({ label, actual, budget, prior, indent, bold, isExpense, separator, showRevPct, totalRev = 0, acctStyle = true, pacingFactor = 1 }: RowProps) {
  const effectiveBudget = budget !== undefined ? budget * pacingFactor : undefined;
  const variance = actual !== undefined && effectiveBudget !== undefined ? actual - effectiveBudget : undefined;

  const varFavorable = variance !== undefined
    ? (isExpense ? variance <= 0 : variance >= 0)
    : null;

  const rowClass = [
    "hover:bg-gray-50 transition-colors",
    separator ? "border-t-2 border-gray-200" : "border-t border-gray-100",
    bold ? "bg-gray-50/60" : "",
  ].filter(Boolean).join(" ");

  const labelClass = [
    "sticky left-0 z-10 px-5 text-xs",
    bold ? "bg-gray-50 py-2 font-semibold text-gray-800" : "bg-white py-2 text-gray-600",
    indent ? "pl-9" : "",
  ].filter(Boolean).join(" ");

  const numClass = `px-4 text-xs text-right tabular-nums ${bold ? "py-2 font-semibold" : "py-2"}`;

  return (
    <tr className={rowClass}>
      <td className={labelClass}>{label}</td>
      <td className={`${numClass} ${actual !== undefined && actual < 0 ? "text-red-600" : "text-gray-900"}`}>
        {actual !== undefined ? fmtDollar(actual, acctStyle) : ""}
      </td>
      <td className={`${numClass} text-gray-400`}>
        {effectiveBudget !== undefined ? fmtDollar(effectiveBudget, acctStyle) : ""}
      </td>
      <td className={`${numClass} font-medium ${
        variance === undefined || variance === 0
          ? "text-gray-300"
          : varFavorable
          ? "text-emerald-600"
          : "text-red-500"
      }`}>
        {variance !== undefined ? fmtVariance(variance, acctStyle) : ""}
      </td>
      <td className={`${numClass} text-gray-400`}>
        {prior !== undefined ? fmtDollar(prior, acctStyle) : ""}
      </td>
      {showRevPct && (
        <td className={`${numClass} text-gray-400`}>
          {fmtRevPct(actual, totalRev)}
        </td>
      )}
    </tr>
  );
}

function SubtotalRow({ label, actual, budget, prior, isExpense, borderStrength = "single", showRevPct, totalRev = 0, acctStyle = true, pacingFactor = 1 }: {
  label: string; actual: number; budget: number | null; prior?: number; isExpense?: boolean; borderStrength?: "single" | "double";
  showRevPct?: boolean; totalRev?: number; acctStyle?: boolean; pacingFactor?: number;
}) {
  const hasBudget = budget !== null;
  const effectiveBudget = hasBudget ? budget * pacingFactor : null;
  const variance = hasBudget ? actual - effectiveBudget! : null;
  const varFavorable = variance !== null && (isExpense ? variance <= 0 : variance >= 0);
  const isKeyLine = borderStrength === "double";

  const rowClass = [
    "hover:bg-gray-50 transition-colors border-t-2 border-gray-200",
    isKeyLine ? "bg-gray-50 border-l-2 border-l-[#E07A3E]" : "bg-gray-50/60",
  ].join(" ");

  const labelClass = `sticky left-0 z-10 px-5 bg-gray-50 text-xs ${isKeyLine ? "py-3 font-bold text-gray-900" : "py-2 font-semibold text-gray-800"}`;
  const numClass = `px-4 text-xs text-right tabular-nums ${isKeyLine ? "py-3 font-bold" : "py-2 font-semibold"}`;

  return (
    <tr className={rowClass}>
      <td className={labelClass}>{label}</td>
      <td className={`${numClass} ${actual < 0 ? "text-red-600" : "text-gray-900"}`}>
        {fmtDollar(actual, acctStyle)}
      </td>
      <td className={`${numClass} ${effectiveBudget !== null && effectiveBudget < 0 ? "text-red-400" : "text-gray-400"}`}>
        {effectiveBudget !== null ? fmtDollar(effectiveBudget, acctStyle) : ""}
      </td>
      <td className={`${numClass} ${
        variance === null || variance === 0 ? "text-gray-300" : varFavorable ? "text-emerald-600" : "text-red-500"
      }`}>
        {variance !== null ? fmtVariance(variance, acctStyle) : ""}
      </td>
      <td className={`${numClass} font-normal text-gray-400`}>
        {prior !== undefined ? fmtDollar(prior, acctStyle) : ""}
      </td>
      {showRevPct && (
        <td className={`${numClass} font-normal text-gray-400`}>
          {fmtRevPct(actual, totalRev)}
        </td>
      )}
    </tr>
  );
}

interface Props {
  current: FinancialData;
  prior?: FinancialData | null;
  pacingPct?: number | null; // null = full month; 0–1 = partial month fraction
}

export function PlTable({ current, prior, pacingPct }: Props) {
  const [showRevPct, setShowRevPct] = useState(false);
  const [acctStyle, setAcctStyle] = useState(false);
  // Default prorated budget to ON when period is partial month
  const [usePaceBudget, setUsePaceBudget] = useState(() => pacingPct !== null && pacingPct !== undefined && pacingPct < 1);

  const is = current.income_statement;
  const pi = prior?.income_statement;
  const totalRev = is.revenue._total.actual;

  // When prorated mode is on, scale full-month budgets to match elapsed days
  const pacingFactor = usePaceBudget && pacingPct ? pacingPct : 1;
  const budgetLabel = usePaceBudget && pacingPct
    ? `Budget (${Math.round(pacingPct * 100)}% pace)`
    : "Budget (Full Mo.)";
  const rowProps = { showRevPct, totalRev, acctStyle, pacingFactor };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-baseline justify-between px-5 py-4 border-b border-gray-200">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Income Statement</h3>
          <p className="text-xs text-gray-400 mt-0.5">MTD vs Budget</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {pacingPct !== null && pacingPct !== undefined && pacingPct < 1 && (
            <button
              onClick={() => setUsePaceBudget(v => !v)}
              className={[
                "text-xs font-medium px-2 py-0.5 rounded border transition-colors duration-150 cursor-pointer",
                usePaceBudget
                  ? "border-[#E07A3E]/40 bg-[#fdf2e9] text-[#E07A3E]"
                  : "border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300",
              ].join(" ")}
              title={usePaceBudget ? "Switch to full-month budget" : "Switch to pace-adjusted budget"}
            >
              Pace
            </button>
          )}
          <button
            onClick={() => setAcctStyle(v => !v)}
            className={[
              "text-xs font-medium px-2 py-0.5 rounded border transition-colors duration-150 cursor-pointer",
              !acctStyle
                ? "border-[#E07A3E]/40 bg-[#fdf2e9] text-[#E07A3E]"
                : "border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300",
            ].join(" ")}
            title={acctStyle ? "Switch to -$x notation" : "Switch to ($x) accounting notation"}
          >
            {acctStyle ? "($x)" : "-$x"}
          </button>
          <button
            onClick={() => setShowRevPct(v => !v)}
            className={[
              "text-xs font-medium px-2 py-0.5 rounded border transition-colors duration-150 cursor-pointer",
              showRevPct
                ? "border-[#E07A3E]/40 bg-[#fdf2e9] text-[#E07A3E]"
                : "border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300",
            ].join(" ")}
          >
            % Rev
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="sticky left-0 z-10 bg-gray-50 px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Line Item</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">MTD Actual</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{budgetLabel}</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">vs Budget</th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Prior Month</th>
            {showRevPct && <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">% Rev</th>}
          </tr>
        </thead>
        <tbody>
          {/* Revenue */}
          <Row label="Revenue" bold actual={is.revenue._total.actual} budget={is.revenue._total.budget} prior={pi?.revenue._total.actual} {...rowProps} />
          <Row label="Workspace Rental" indent actual={is.revenue.workspace_rental.actual} budget={is.revenue.workspace_rental.budget} prior={pi?.revenue.workspace_rental.actual} {...rowProps} />
          <Row label="Meeting Space" indent actual={is.revenue.meeting_space.actual} budget={is.revenue.meeting_space.budget} prior={pi?.revenue.meeting_space.actual} {...rowProps} />
          <Row label="Package Revenue" indent actual={is.revenue.package_revenue.actual} budget={is.revenue.package_revenue.budget} prior={pi?.revenue.package_revenue.actual} {...rowProps} />
          <Row label="Member Amenities" indent actual={is.revenue.member_amenities.actual} budget={is.revenue.member_amenities.budget} prior={pi?.revenue.member_amenities.actual} {...rowProps} />
          <Row label="Membership" indent actual={is.revenue.membership.actual} budget={is.revenue.membership.budget} prior={pi?.revenue.membership.actual} {...rowProps} />
          <Row label="Registration & Access" indent actual={is.revenue.registration_access.actual} budget={is.revenue.registration_access.budget} prior={pi?.revenue.registration_access.actual} {...rowProps} />
          <Row label="Miscellaneous" indent actual={is.revenue.miscellaneous.actual} budget={is.revenue.miscellaneous.budget} prior={pi?.revenue.miscellaneous.actual} {...rowProps} />

          {/* Cost of Sales */}
          <Row label="Cost of Sales" bold separator isExpense actual={is.cos._total.actual} budget={is.cos._total.budget} prior={pi?.cos._total.actual} {...rowProps} />
          <Row label="Direct COS" indent isExpense actual={is.cos.direct_cos.actual} budget={is.cos.direct_cos.budget} prior={pi?.cos.direct_cos.actual} {...rowProps} />
          <Row label="Community" indent isExpense actual={is.cos.community.actual} budget={is.cos.community.budget} prior={pi?.cos.community.actual} {...rowProps} />

          {/* Gross Profit */}
          <SubtotalRow
            label={`Gross Profit (${is.gross_profit.margin_pct.toFixed(1)}%)`}
            actual={is.gross_profit.actual}
            budget={is.gross_profit.budget}
            prior={pi?.gross_profit.actual}
            showRevPct={showRevPct}
            totalRev={totalRev}
            acctStyle={acctStyle}
            pacingFactor={pacingFactor}
          />

          {/* Operating Expenses */}
          <Row label="Operating Expenses" bold separator isExpense actual={is.opex._total.actual} budget={is.opex._total.budget} prior={pi?.opex._total.actual} {...rowProps} />
          <Row label="Payroll" indent isExpense actual={is.opex.payroll.actual} budget={is.opex.payroll.budget} prior={pi?.opex.payroll.actual} {...rowProps} />
          <Row label="Facilities" indent isExpense actual={is.opex.facilities.actual} budget={is.opex.facilities.budget} prior={pi?.opex.facilities.actual} {...rowProps} />
          <Row label="Insurance" indent isExpense actual={is.opex.insurance.actual} budget={is.opex.insurance.budget} prior={pi?.opex.insurance.actual} {...rowProps} />
          <Row label="Admin / Legal" indent isExpense actual={is.opex.admin_legal.actual} budget={is.opex.admin_legal.budget} prior={pi?.opex.admin_legal.actual} {...rowProps} />
          <Row label="Marketing" indent isExpense actual={is.opex.marketing.actual} budget={is.opex.marketing.budget} prior={pi?.opex.marketing.actual} {...rowProps} />
          <Row label="Meals & Entertainment" indent isExpense actual={is.opex.meals_entertainment.actual} budget={is.opex.meals_entertainment.budget} prior={pi?.opex.meals_entertainment.actual} {...rowProps} />
          <Row label="Office Expense" indent isExpense actual={is.opex.office_supplies.actual} budget={is.opex.office_supplies.budget} prior={pi?.opex.office_supplies.actual} {...rowProps} />
          <Row label="Technology" indent isExpense actual={is.opex.technology.actual} budget={is.opex.technology.budget} prior={pi?.opex.technology.actual} {...rowProps} />
          <Row label="Travel" indent isExpense actual={is.opex.travel.actual} budget={is.opex.travel.budget} prior={pi?.opex.travel.actual} {...rowProps} />
          <Row label="Utilities" indent isExpense actual={is.opex.utilities.actual} budget={is.opex.utilities.budget} prior={pi?.opex.utilities.actual} {...rowProps} />
          <Row label="Other OPEX" indent isExpense actual={is.opex.other.actual} budget={is.opex.other.budget} prior={pi?.opex.other.actual} {...rowProps} />

          {/* Net Operating Income */}
          <SubtotalRow
            label={`Net Operating Income (${is.net_operating_income.margin_pct.toFixed(1)}%)`}
            actual={is.net_operating_income.actual}
            budget={is.net_operating_income.budget}
            prior={pi?.net_operating_income.actual}
            borderStrength="double"
            showRevPct={showRevPct}
            totalRev={totalRev}
            acctStyle={acctStyle}
            pacingFactor={pacingFactor}
          />

          {/* Other Income / Expense */}
          {(is.other_income_expense._total.actual !== 0 || is.other_income_expense._total.budget !== 0) && (
            <>
              <Row label="Other Income / Expense" bold separator actual={is.other_income_expense._total.actual} budget={is.other_income_expense._total.budget} prior={pi?.other_income_expense._total.actual} {...rowProps} />
              {is.other_income_expense.other_income.actual !== 0 && (
                <Row label="Other Income" indent actual={is.other_income_expense.other_income.actual} budget={is.other_income_expense.other_income.budget} prior={pi?.other_income_expense.other_income.actual} {...rowProps} />
              )}
              {is.other_income_expense.other_expense.actual !== 0 && (
                <Row label="Other Expense" indent isExpense actual={is.other_income_expense.other_expense.actual} budget={is.other_income_expense.other_expense.budget} prior={pi?.other_income_expense.other_expense.actual} {...rowProps} />
              )}
            </>
          )}

          {/* Net Income */}
          <SubtotalRow
            label={`Net Income (${is.net_income.margin_pct.toFixed(1)}%)`}
            actual={is.net_income.actual}
            budget={null}
            prior={pi?.net_income.actual}
            borderStrength="double"
            showRevPct={showRevPct}
            totalRev={totalRev}
            acctStyle={acctStyle}
            pacingFactor={1}
          />
        </tbody>
      </table>
      </div>
    </div>
  );
}
