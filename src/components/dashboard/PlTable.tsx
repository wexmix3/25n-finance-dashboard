import { FinancialData, LineItem } from "@/types/dashboard";

function fmtNum(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n < 0 ? `(${formatted})` : formatted;
}

function fmtDollar(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${n < 0 ? "($" : "$"}${formatted}${n < 0 ? ")" : ""}`;
}

interface RowProps {
  label: string;
  current?: number;
  budget?: number;
  prior?: number;
  indent?: boolean;
  bold?: boolean;
  highlight?: "positive" | "negative" | "neutral";
}

function Row({ label, current, budget, prior, indent, bold, highlight }: RowProps) {
  const baseRow = "grid grid-cols-4 gap-2 py-1.5 text-sm border-b border-gray-100 last:border-0";
  const bgMap = {
    positive: "bg-emerald-50",
    negative: "bg-red-50",
    neutral: "bg-gray-50",
    undefined: "",
  };

  return (
    <div className={`${baseRow} ${bgMap[highlight ?? "undefined"]} ${bold ? "font-semibold" : ""}`}>
      <span className={`text-gray-700 ${indent ? "pl-4" : ""}`}>{label}</span>
      <span className={`text-right tabular-nums ${current !== undefined && current < 0 ? "text-red-600" : "text-gray-900"}`}>
        {current !== undefined ? fmtDollar(current) : ""}
      </span>
      <span className="text-right tabular-nums text-gray-400">
        {budget !== undefined ? fmtDollar(budget) : ""}
      </span>
      <span className="text-right tabular-nums text-gray-400">
        {prior !== undefined ? fmtDollar(prior) : ""}
      </span>
    </div>
  );
}

interface SectionHeaderProps {
  label: string;
}

function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div className="grid grid-cols-4 gap-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-200 mt-3">
      <span>{label}</span>
      <span className="text-right">Current MTD</span>
      <span className="text-right">Budget</span>
      <span className="text-right">Prior Final</span>
    </div>
  );
}

interface Props {
  current: FinancialData;
  prior?: FinancialData | null;
}

export function PlTable({ current, prior }: Props) {
  const is = current.income_statement;
  const pi = prior?.income_statement;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Income Statement</h3>
      <p className="text-xs text-gray-400 mb-3">Budget = full-month projection</p>

      <SectionHeader label="Revenue" />
      <Row label="Memberships" indent current={is.revenue.memberships.actual} budget={is.revenue.memberships.budget} prior={pi?.revenue.memberships.actual} />
      <Row label="Meeting Space" indent current={is.revenue.meeting_space.actual} budget={is.revenue.meeting_space.budget} prior={pi?.revenue.meeting_space.actual} />
      <Row label="Mail / Virtual" indent current={is.revenue.mail_virtual.actual} budget={is.revenue.mail_virtual.budget} prior={pi?.revenue.mail_virtual.actual} />
      <Row label="Other Services" indent current={is.revenue.other_services.actual} budget={is.revenue.other_services.budget} prior={pi?.revenue.other_services.actual} />
      <Row label="Other Income" indent current={is.revenue.other_income.actual} budget={is.revenue.other_income.budget} prior={pi?.revenue.other_income.actual} />
      <Row label="Total Revenue" bold current={is.revenue._total.actual} budget={is.revenue._total.budget} prior={pi?.revenue._total.actual} />

      <SectionHeader label="Cost of Sales" />
      <Row label="Direct COS" indent current={is.cos.direct_cos.actual} budget={is.cos.direct_cos.budget} prior={pi?.cos.direct_cos.actual} />
      <Row label="Community" indent current={is.cos.community.actual} budget={is.cos.community.budget} prior={pi?.cos.community.actual} />

      <div className="grid grid-cols-4 gap-2 py-2 text-sm font-semibold border-b-2 border-gray-300 mt-1">
        <span className="text-gray-700">Gross Profit</span>
        <span className={`text-right tabular-nums ${is.gross_profit.actual < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {fmtDollar(is.gross_profit.actual)}
          <span className="ml-1 text-xs font-normal text-gray-400">{is.gross_profit.margin_pct.toFixed(1)}%</span>
        </span>
        <span className="text-right tabular-nums text-gray-400">{fmtDollar(is.gross_profit.budget)}</span>
        <span className="text-right tabular-nums text-gray-400">{pi ? fmtDollar(pi.gross_profit.actual) : ""}</span>
      </div>

      <SectionHeader label="Operating Expenses" />
      <Row label="Payroll" indent current={is.opex.payroll.actual} budget={is.opex.payroll.budget} prior={pi?.opex.payroll.actual} />
      <Row label="Facilities" indent current={is.opex.facilities.actual} budget={is.opex.facilities.budget} prior={pi?.opex.facilities.actual} />
      <Row label="Admin / Legal" indent current={is.opex.admin_legal.actual} budget={is.opex.admin_legal.budget} prior={pi?.opex.admin_legal.actual} />
      <Row label="Marketing" indent current={is.opex.marketing.actual} budget={is.opex.marketing.budget} prior={pi?.opex.marketing.actual} />
      <Row label="Technology" indent current={is.opex.technology.actual} budget={is.opex.technology.budget} prior={pi?.opex.technology.actual} />
      <Row label="Utilities" indent current={is.opex.utilities.actual} budget={is.opex.utilities.budget} prior={pi?.opex.utilities.actual} />
      <Row label="Other OPEX" indent current={is.opex.other.actual} budget={is.opex.other.budget} prior={pi?.opex.other.actual} />
      <Row label="Total OPEX" bold current={is.opex._total.actual} budget={is.opex._total.budget} prior={pi?.opex._total.actual} />

      <div className="grid grid-cols-4 gap-2 py-2.5 text-sm font-bold border-b-2 border-gray-400 mt-1">
        <span className="text-gray-900">Net Operating Income</span>
        <span className={`text-right tabular-nums ${is.net_operating_income.actual < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {fmtDollar(is.net_operating_income.actual)}
          <span className="ml-1 text-xs font-normal text-gray-400">{is.net_operating_income.margin_pct.toFixed(1)}%</span>
        </span>
        <span className={`text-right tabular-nums ${is.net_operating_income.budget < 0 ? "text-red-400" : "text-gray-400"}`}>
          {fmtDollar(is.net_operating_income.budget)}
        </span>
        <span className="text-right tabular-nums text-gray-400">
          {pi ? fmtDollar(pi.net_operating_income.actual) : ""}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 py-2.5 text-sm font-bold mt-1">
        <span className="text-gray-900">Net Income</span>
        <span className={`text-right tabular-nums ${is.net_income.actual < 0 ? "text-red-600" : "text-emerald-600"}`}>
          {fmtDollar(is.net_income.actual)}
        </span>
        <span className="text-right" />
        <span className="text-right tabular-nums text-gray-400">
          {pi ? fmtDollar(pi.net_income.actual) : ""}
        </span>
      </div>
    </div>
  );
}
