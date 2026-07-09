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
  highlight?: "positive" | "negative" | "neutral";
  showRevPct?: boolean;
  totalRev?: number;
  acctStyle?: boolean;
  pacingFactor?: number;
}

function Row({ label, actual, budget, prior, indent, bold, isExpense, highlight, showRevPct, totalRev = 0, acctStyle = true, pacingFactor = 1 }: RowProps) {
  const effectiveBudget = budget !== undefined ? budget * pacingFactor : undefined;
  const variance = actual !== undefined && effectiveBudget !== undefined ? actual - effectiveBudget : undefined;

  const varFavorable = variance !== undefined
    ? (isExpense ? variance <= 0 : variance >= 0)
    : null;

  const bgMap: Record<string, string> = {
    positive: "bg-emerald-50",
    negative: "bg-red-50",
    neutral: "bg-gray-50",
  };
  const rowBg = highlight ? bgMap[highlight] : "";
  const cols = showRevPct ? "[grid-template-columns:2fr_repeat(5,1fr)]" : "[grid-template-columns:2fr_repeat(4,1fr)]";

  return (
    <div className={`grid gap-2 py-1.5 text-sm border-b border-gray-100 last:border-0 ${cols} ${rowBg} ${bold ? "font-semibold" : ""}`}>
      <span className={`text-gray-700 ${indent ? "pl-4" : ""} truncate`}>{label}</span>
      <span className={`text-right tabular-nums ${actual !== undefined && actual < 0 ? "text-red-600" : "text-gray-900"}`}>
        {actual !== undefined ? fmtDollar(actual, acctStyle) : ""}
      </span>
      <span className="text-right tabular-nums text-gray-400">
        {effectiveBudget !== undefined ? fmtDollar(effectiveBudget, acctStyle) : ""}
      </span>
      <span className={`text-right tabular-nums font-medium text-xs ${
        variance === undefined || variance === 0
          ? "text-gray-300"
          : varFavorable
          ? "text-emerald-600"
          : "text-red-500"
      }`}>
        {variance !== undefined ? fmtVariance(variance, acctStyle) : ""}
      </span>
      <span className="text-right tabular-nums text-gray-400">
        {prior !== undefined ? fmtDollar(prior, acctStyle) : ""}
      </span>
      {showRevPct && (
        <span className="text-right tabular-nums text-xs text-gray-400">
          {fmtRevPct(actual, totalRev)}
        </span>
      )}
    </div>
  );
}

function SectionHeader({ label, showRevPct, budgetLabel }: { label: string; showRevPct?: boolean; budgetLabel: string }) {
  const cols = showRevPct ? "[grid-template-columns:2fr_repeat(5,1fr)]" : "[grid-template-columns:2fr_repeat(4,1fr)]";
  return (
    <div className={`grid gap-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 mt-3 ${cols}`}>
      <span>{label}</span>
      <span className="text-right">MTD Actual</span>
      <span className="text-right">{budgetLabel}</span>
      <span className="text-right">vs Budget</span>
      <span className="text-right">Prior Month</span>
      {showRevPct && <span className="text-right">% Rev</span>}
    </div>
  );
}

function SubtotalRow({ label, actual, budget, prior, isExpense, borderStrength = "single", showRevPct, totalRev = 0, acctStyle = true, pacingFactor = 1 }: {
  label: string; actual: number; budget: number; prior?: number; isExpense?: boolean; borderStrength?: "single" | "double";
  showRevPct?: boolean; totalRev?: number; acctStyle?: boolean; pacingFactor?: number;
}) {
  const effectiveBudget = budget * pacingFactor;
  const variance = actual - effectiveBudget;
  const varFavorable = isExpense ? variance <= 0 : variance >= 0;
  const isKeyLine = borderStrength === "double";
  const borderClass = isKeyLine ? "border-b-2 border-gray-300" : "border-b border-gray-200";
  const bgClass = isKeyLine ? "bg-gray-50 rounded" : "bg-gray-50/50";
  const cols = showRevPct ? "[grid-template-columns:2fr_repeat(5,1fr)]" : "[grid-template-columns:2fr_repeat(4,1fr)]";

  return (
    <div className={`grid gap-2 py-2.5 text-sm font-bold mt-1 ${borderClass} ${bgClass} ${cols} ${isKeyLine ? "border-l-2 border-l-[#E07A3E] pl-2 -ml-2" : ""}`}>
      <span className={`${isKeyLine ? "text-gray-900 text-base" : "text-gray-800"}`}>{label}</span>
      <span className={`text-right tabular-nums ${actual < 0 ? "text-red-600" : "text-emerald-600"}`}>
        {fmtDollar(actual, acctStyle)}
      </span>
      <span className={`text-right tabular-nums ${effectiveBudget < 0 ? "text-red-400" : "text-gray-400"}`}>
        {fmtDollar(effectiveBudget, acctStyle)}
      </span>
      <span className={`text-right tabular-nums font-medium text-xs ${
        variance === 0 ? "text-gray-300" : varFavorable ? "text-emerald-600" : "text-red-500"
      }`}>
        {fmtVariance(variance, acctStyle)}
      </span>
      <span className="text-right tabular-nums text-gray-400">
        {prior !== undefined ? fmtDollar(prior, acctStyle) : ""}
      </span>
      {showRevPct && (
        <span className="text-right tabular-nums text-xs text-gray-400 font-normal">
          {fmtRevPct(actual, totalRev)}
        </span>
      )}
    </div>
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
    <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">Income Statement</h3>
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

      {/* Revenue */}
      <SectionHeader label="Revenue" showRevPct={showRevPct} budgetLabel={budgetLabel} />
      <Row label="Workspace Rental" indent actual={is.revenue.workspace_rental.actual} budget={is.revenue.workspace_rental.budget} prior={pi?.revenue.workspace_rental.actual} {...rowProps} />
      <Row label="Meeting Space" indent actual={is.revenue.meeting_space.actual} budget={is.revenue.meeting_space.budget} prior={pi?.revenue.meeting_space.actual} {...rowProps} />
      <Row label="Package Revenue" indent actual={is.revenue.package_revenue.actual} budget={is.revenue.package_revenue.budget} prior={pi?.revenue.package_revenue.actual} {...rowProps} />
      <Row label="Member Amenities" indent actual={is.revenue.member_amenities.actual} budget={is.revenue.member_amenities.budget} prior={pi?.revenue.member_amenities.actual} {...rowProps} />
      <Row label="Membership" indent actual={is.revenue.membership.actual} budget={is.revenue.membership.budget} prior={pi?.revenue.membership.actual} {...rowProps} />
      <Row label="Registration & Access" indent actual={is.revenue.registration_access.actual} budget={is.revenue.registration_access.budget} prior={pi?.revenue.registration_access.actual} {...rowProps} />
      <Row label="Miscellaneous" indent actual={is.revenue.miscellaneous.actual} budget={is.revenue.miscellaneous.budget} prior={pi?.revenue.miscellaneous.actual} {...rowProps} />
      <Row label="Total Revenue" bold actual={is.revenue._total.actual} budget={is.revenue._total.budget} prior={pi?.revenue._total.actual} {...rowProps} />

      {/* Cost of Sales */}
      <SectionHeader label="Cost of Sales" showRevPct={showRevPct} budgetLabel={budgetLabel} />
      <Row label="Direct COS" indent isExpense actual={is.cos.direct_cos.actual} budget={is.cos.direct_cos.budget} prior={pi?.cos.direct_cos.actual} {...rowProps} />
      <Row label="Community" indent isExpense actual={is.cos.community.actual} budget={is.cos.community.budget} prior={pi?.cos.community.actual} {...rowProps} />

      {/* Gross Profit */}
      <SubtotalRow
        label="Gross Profit"
        actual={is.gross_profit.actual}
        budget={is.gross_profit.budget}
        prior={pi?.gross_profit.actual}
        showRevPct={showRevPct}
        totalRev={totalRev}
        acctStyle={acctStyle}
        pacingFactor={pacingFactor}
      />

      {/* Operating Expenses */}
      <SectionHeader label="Operating Expenses" showRevPct={showRevPct} budgetLabel={budgetLabel} />
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
      <Row label="Total OPEX" bold isExpense actual={is.opex._total.actual} budget={is.opex._total.budget} prior={pi?.opex._total.actual} {...rowProps} />

      {/* Net Operating Income */}
      <SubtotalRow
        label="NOI"
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
          <SectionHeader label="Other Income / Expense" showRevPct={showRevPct} budgetLabel={budgetLabel} />
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
        label="Net Income"
        actual={is.net_income.actual}
        budget={0}
        prior={pi?.net_income.actual}
        borderStrength="double"
        showRevPct={showRevPct}
        totalRev={totalRev}
        acctStyle={acctStyle}
        pacingFactor={1}
      />
    </div>
  );
}
