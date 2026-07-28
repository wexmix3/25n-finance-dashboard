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
  valueNegative?: boolean;
  sub?: string;
  subPositive?: boolean;
  projection?: string;
  highlight?: boolean;
  info?: { title: string; formula?: string; source?: string; note?: string };
}

function KpiCard({ label, value, valueNegative, sub, subPositive, projection, highlight, info }: KpiCardProps) {
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
      {/* Negative = red, everything else = neutral — same convention as the
          P&L table below it, so a loss reads the same way in both places. */}
      <p className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${valueNegative ? "text-red-600" : "text-gray-900"}`}>{value}</p>
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
  const ni = is.net_income.actual;
  const netMargin = is.net_income.margin_pct;
  const budgetRev = is.revenue._total.budget;
  const budgetNi = is.net_income.budget;

  // Only show MoM% for closed periods — MTD vs prior full month is misleading
  const isPartial = pacingPct !== null && pacingPct !== undefined && pacingPct < 1;
  const revDelta = !isPartial && prior ? momDelta(rev, prior.income_statement.revenue._total.actual) : null;
  const niDelta = !isPartial && prior ? momDelta(ni, prior.income_statement.net_income.actual) : null;
  const netMarginDelta = !isPartial && prior
    ? { diff: netMargin - prior.income_statement.net_income.margin_pct, positive: netMargin >= prior.income_statement.net_income.margin_pct }
    : null;

  // Prorate budget comparison for partial months (Net Income only — Revenue is
  // mostly contractual and posts in full on the 1st, so prorating its budget
  // manufactures a fake shortfall/surplus signal for most of the month. NI
  // includes OPEX, which does accrue through the month, so proration still holds.)
  const effectivePacing = pacingPct ?? 1;
  const proratedNiBudget = budgetNi * effectivePacing;

  // Below this budget magnitude, a % variance explodes into noise (e.g. a $777
  // miss on a $63 budget reads as +1200%) — show the absolute dollar miss
  // instead once the denominator gets too small to carry a meaningful ratio.
  const PCT_DENOMINATOR_FLOOR = 2000;
  const revBudgetVariance = rev - budgetRev;
  const vsBudgetRevPct = Math.abs(budgetRev) >= PCT_DENOMINATOR_FLOOR
    ? (revBudgetVariance / Math.abs(budgetRev)) * 100
    : null;
  const vsBudgetNi = Math.abs(proratedNiBudget) >= PCT_DENOMINATOR_FLOOR
    ? ((ni - proratedNiBudget) / Math.abs(proratedNiBudget)) * 100
    : null;
  const niMissTooSmallForPct = Math.abs(proratedNiBudget) < PCT_DENOMINATOR_FLOOR && proratedNiBudget !== 0;

  // Revenue run-rate only — OPEX is fixed-cost so NOI projection math is invalid
  const projRev = runRateFactor ? `→ ${fmt(rev * runRateFactor)} est. full-mo.` : undefined;
  const mtdLabel = isPartial ? `Day ${Math.round(effectivePacing * 30)} MTD` : undefined;
  const budgetNote = isPartial ? `vs ${Math.round(effectivePacing * 100)}% of budget` : "vs full-month budget";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
    <div className="flex-1">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">This period vs. last</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 h-[calc(100%-1.375rem)]">
      <KpiCard
        label="Revenue"
        value={fmt(rev)}
        valueNegative={rev < 0}
        sub={revDelta?.label ?? mtdLabel}
        subPositive={revDelta?.positive}
        projection={projRev}
        info={{ title: "Total Revenue", formula: "Workspace Rental + Meeting Space + Package Revenue + Member Amenities + Membership + Registration & Access + Miscellaneous", source: "Yardi Scheduler_Reports — 12-Month Income Statement" }}
      />
      <KpiCard
        label="Net Margin"
        value={`${netMargin.toFixed(1)}%`}
        valueNegative={netMargin < 0}
        sub={netMarginDelta ? `${netMarginDelta.diff >= 0 ? "+" : ""}${netMarginDelta.diff.toFixed(1)}pp MoM` : mtdLabel}
        subPositive={netMarginDelta ? netMarginDelta.positive : netMargin >= 0}
        info={{ title: "Net Margin", formula: "Net Income ÷ Total Revenue", source: "Yardi Scheduler_Reports", note: "The bottom-line profitability rate — what share of every revenue dollar the location actually keeps after all expenses." }}
      />
      <KpiCard
        label="Net Income"
        value={fmt(ni)}
        valueNegative={ni < 0}
        sub={niDelta?.label ?? mtdLabel}
        subPositive={niDelta ? niDelta.positive : ni >= 0}
        info={{ title: "Net Income", formula: "NOI + Other Income − Other Expenses", source: "Yardi Scheduler_Reports" }}
      />
      </div>
    </div>

    <div className="hidden lg:block w-px bg-gray-200 my-1" />

    <div className="lg:w-[300px] lg:flex-shrink-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-0.5">This period vs. budget</p>
      <div className="grid grid-cols-2 gap-3 h-[calc(100%-1.375rem)]">
      <KpiCard
        label="Revenue vs Budget"
        value={`${revBudgetVariance >= 0 ? "+" : "-"}${fmt(Math.abs(revBudgetVariance))}`}
        sub={vsBudgetRevPct !== null ? `${vsBudgetRevPct >= 0 ? "+" : ""}${vsBudgetRevPct.toFixed(1)}% of budget` : "vs full-month budget"}
        subPositive={revBudgetVariance >= 0}
        highlight
        info={{ title: "Revenue vs Budget", formula: "Revenue − Full-Month Budget", source: "Budget from Yardi Budget Comparison export", note: "Most 25N revenue is contractual and posts in full on the 1st, so this is always compared to the full-month budget — never prorated by elapsed days — and shown as a $ variance." }}
      />
      <KpiCard
        label="Net Income vs Budget"
        value={
          vsBudgetNi !== null
            ? `${vsBudgetNi >= 0 ? "+" : ""}${vsBudgetNi.toFixed(1)}%`
            : niMissTooSmallForPct
            ? fmt(ni - proratedNiBudget)
            : "—"
        }
        sub={niMissTooSmallForPct ? "budget too small for a % — showing $ miss" : budgetNote}
        subPositive={vsBudgetNi !== null ? vsBudgetNi >= 0 : niMissTooSmallForPct ? ni >= proratedNiBudget : undefined}
        highlight
        info={{ title: "Net Income vs Budget", formula: isPartial ? `(MTD NI − NI Budget × ${Math.round(effectivePacing * 100)}%) ÷ |Prorated NI Budget|` : "(NI − Full-Month NI Budget) ÷ |NI Budget|", source: "NI budget from Yardi Budget Comparison export (account 9900)", note: `Primary profitability-vs-plan signal now that NOI is no longer shown separately. Below a $${PCT_DENOMINATOR_FLOOR.toLocaleString()} budget, the % swings wildly (a small-dollar miss reads as +1000%+), so the $ miss is shown instead.` }}
      />
      </div>
    </div>
    </div>
  );
}
