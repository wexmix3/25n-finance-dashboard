import { FinancialData } from "@/types/dashboard";
import { InfoPopover } from "@/components/ui/InfoPopover";

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(0)}K`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

function momDelta(current: number, prior: number): { label: string; positive: boolean } | null {
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
  projection?: string;
  highlight?: boolean;
  info?: { title: string; formula?: string; source?: string; note?: string };
}

function KpiCard({ label, value, sub, subPositive, projection, highlight, info }: KpiCardProps) {
  // Flat, borderless stat tile — deliberately distinct from the bordered
  // white "container" cards (tables, panels) elsewhere on the dashboard, so
  // a glanceable number and a detailed data table don't carry equal visual
  // weight. The single most important metric gets a colored left accent
  // instead of a full border, keeping the emphasis without adding a box.
  return (
    <div className={`rounded-lg bg-gray-50 p-4 ${highlight ? "border-l-4 border-[#E07A3E]" : ""}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center">
        {label}
        {info && <InfoPopover {...info} />}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
      {sub && (
        <p className={`mt-0.5 text-xs font-medium ${subPositive === undefined ? "text-gray-400" : subPositive ? "text-emerald-600" : "text-red-500"}`}>
          {sub}
        </p>
      )}
      {projection && (
        <p className="mt-0.5 text-xs text-gray-400">{projection}</p>
      )}
    </div>
  );
}

interface Props {
  current: FinancialData;
  prior?: FinancialData | null;
  runRateFactor?: number | null;
  pacingPct?: number | null;
}

export function IncomeKpiRow({ current, prior, runRateFactor, pacingPct }: Props) {
  const is = current.income_statement;
  const rev = is.revenue._total.actual;
  const noi = is.net_operating_income.actual;
  const ni = is.net_income.actual;
  const netMargin = is.net_income.margin_pct;
  const budgetRev = is.revenue._total.budget;
  const budgetNoi = is.net_operating_income.budget;

  // Only show MoM% for closed periods — MTD vs prior full month is misleading
  const isPartial = pacingPct !== null && pacingPct !== undefined && pacingPct < 1;
  const revDelta = !isPartial && prior ? momDelta(rev, prior.income_statement.revenue._total.actual) : null;
  const noiDelta = !isPartial && prior ? momDelta(noi, prior.income_statement.net_operating_income.actual) : null;
  const niDelta = !isPartial && prior ? momDelta(ni, prior.income_statement.net_income.actual) : null;
  const netMarginDelta = !isPartial && prior
    ? { diff: netMargin - prior.income_statement.net_income.margin_pct, positive: netMargin >= prior.income_statement.net_income.margin_pct }
    : null;

  // Prorate budget comparison for partial months
  const effectivePacing = pacingPct ?? 1;
  const proratedRevBudget = budgetRev * effectivePacing;
  const proratedNoiBudget = budgetNoi * effectivePacing;

  const vsBudgetRev = proratedRevBudget
    ? ((rev - proratedRevBudget) / Math.abs(proratedRevBudget)) * 100
    : null;
  const vsBudgetNoi = proratedNoiBudget
    ? ((noi - proratedNoiBudget) / Math.abs(proratedNoiBudget)) * 100
    : null;

  // Revenue run-rate only — OPEX is fixed-cost so NOI projection math is invalid
  const projRev = runRateFactor ? `→ ${fmt(rev * runRateFactor)} est. full-mo.` : undefined;
  const mtdLabel = isPartial ? `Day ${Math.round(effectivePacing * 30)} MTD` : undefined;
  const budgetNote = isPartial ? `vs ${Math.round(effectivePacing * 100)}% of budget` : "vs full-month budget";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Revenue"
        value={fmt(rev)}
        sub={revDelta?.label ?? mtdLabel}
        subPositive={revDelta?.positive}
        projection={projRev}
        info={{ title: "Total Revenue", formula: "Workspace Rental + Meeting Space + Package Revenue + Member Amenities + Membership + Registration & Access + Miscellaneous", source: "Yardi Scheduler_Reports — 12-Month Income Statement" }}
      />
      <KpiCard
        label="Net Margin"
        value={`${netMargin.toFixed(1)}%`}
        sub={netMarginDelta ? `${netMarginDelta.diff >= 0 ? "+" : ""}${netMarginDelta.diff.toFixed(1)}pp MoM` : mtdLabel}
        subPositive={netMarginDelta ? netMarginDelta.positive : netMargin >= 0}
        info={{ title: "Net Margin", formula: "Net Income ÷ Total Revenue", source: "Yardi Scheduler_Reports", note: "The bottom-line profitability rate — what share of every revenue dollar the location actually keeps after all expenses." }}
      />
      <KpiCard
        label="NOI"
        value={fmt(noi)}
        sub={`${is.net_operating_income.margin_pct.toFixed(1)}% operating margin`}
        subPositive={noiDelta ? noiDelta.positive : noi >= 0}
        info={{ title: "Net Operating Income (NOI)", formula: "Gross Profit − Total Operating Expenses", source: "Yardi Scheduler_Reports", note: "Operating Margin = NOI ÷ Revenue. Primary profitability metric for coworking — positive NOI means the location covers all operating costs from its own revenue." }}
      />
      <KpiCard
        label="Net Income"
        value={fmt(ni)}
        sub={niDelta?.label ?? mtdLabel}
        subPositive={niDelta ? niDelta.positive : ni >= 0}
        info={{ title: "Net Income", formula: "NOI + Other Income − Other Expenses", source: "Yardi Scheduler_Reports" }}
      />
      <KpiCard
        label="Revenue vs Budget"
        value={vsBudgetRev !== null ? `${vsBudgetRev >= 0 ? "+" : ""}${vsBudgetRev.toFixed(1)}%` : "—"}
        sub={budgetNote}
        subPositive={vsBudgetRev !== null && vsBudgetRev >= 0}
        highlight
        info={{ title: "Revenue vs Budget", formula: isPartial ? `(MTD Revenue − Budget × ${Math.round(effectivePacing * 100)}%) ÷ |Prorated Budget|` : "(Revenue − Full-Month Budget) ÷ |Budget|", source: "Budget from Yardi Budget Comparison export", note: isPartial ? "Budget is prorated to match elapsed days so Day-8 actuals aren't compared to a full-month target." : undefined }}
      />
      <KpiCard
        label="NOI vs Budget"
        value={vsBudgetNoi !== null ? `${vsBudgetNoi >= 0 ? "+" : ""}${vsBudgetNoi.toFixed(1)}%` : "—"}
        sub={budgetNote}
        subPositive={vsBudgetNoi !== null && vsBudgetNoi >= 0}
        info={{ title: "NOI vs Budget", formula: isPartial ? `(MTD NOI − NOI Budget × ${Math.round(effectivePacing * 100)}%) ÷ |Prorated NOI Budget|` : "(NOI − Full-Month NOI Budget) ÷ |NOI Budget|", source: "NOI budget from Yardi Budget Comparison export", note: "Key signal for whether the location is on track for its profitability target." }}
      />
    </div>
  );
}
