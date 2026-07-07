import { FinancialData } from "@/types/dashboard";

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

function delta(current: number, prior: number): { label: string; positive: boolean } | null {
  if (!prior) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  return {
    label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% MoM`,
    positive: pct >= 0,
  };
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  subPositive?: boolean;
  highlight?: boolean;
}

function KpiCard({ label, value, sub, subPositive, highlight }: KpiCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-gray-300 bg-gray-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {sub && (
        <p className={`mt-0.5 text-xs font-medium ${subPositive ? "text-emerald-600" : "text-red-500"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

interface Props {
  current: FinancialData;
  prior?: FinancialData | null;
}

export function IncomeKpiRow({ current, prior }: Props) {
  const is = current.income_statement;
  const rev = is.revenue._total.actual;
  const gp = is.gross_profit.actual;
  const noi = is.net_operating_income.actual;
  const ni = is.net_income.actual;
  const budgetRev = is.revenue._total.budget;

  const revDelta = prior ? delta(rev, prior.income_statement.revenue._total.actual) : null;
  const noiDelta = prior ? delta(noi, prior.income_statement.net_operating_income.actual) : null;

  const vsBudgetPct = budgetRev
    ? ((rev - budgetRev) / Math.abs(budgetRev)) * 100
    : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Revenue"
        value={fmt(rev)}
        sub={revDelta?.label}
        subPositive={revDelta?.positive}
      />
      <KpiCard
        label="Gross Profit %"
        value={`${is.gross_profit.margin_pct.toFixed(1)}%`}
      />
      <KpiCard
        label="NOI"
        value={fmt(noi)}
        sub={noiDelta?.label}
        subPositive={noiDelta?.positive}
      />
      <KpiCard
        label="Net Income"
        value={fmt(ni)}
      />
      <KpiCard
        label="vs Budget"
        value={vsBudgetPct !== null ? `${vsBudgetPct >= 0 ? "+" : ""}${vsBudgetPct.toFixed(1)}%` : "—"}
        subPositive={vsBudgetPct !== null && vsBudgetPct >= 0}
        highlight
      />
      {current.reconciliation_notes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 col-span-1">
          <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Recon Flag</p>
          <p className="mt-1 text-xs text-amber-600">{current.reconciliation_notes[0]}</p>
        </div>
      )}
    </div>
  );
}
