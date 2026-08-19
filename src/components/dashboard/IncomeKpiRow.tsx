import { FinancialData } from "@/types/dashboard";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { formatCurrency } from "@/lib/formatCurrency";

function fmt(n: number): string {
  return formatCurrency(n, { compact: true, zeroDash: false });
}

function momDelta(current: number, prior: number): { label: string; positive: boolean } | null {
  if (!prior) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  return {
    label: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% MoM`,
    positive: pct >= 0,
  };
}

// Small badge icon in the card's top-left corner (Reference Inspiration #2).
// One shared glyph is enough — the badge's job is to give the eye a fixed
// anchor point per card, not to encode a different meaning per metric.
function KpiIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  valueNegative?: boolean;
  /** Inline colored pill next to the label — a delta (MoM% or vs-budget%), not a full row. */
  delta?: { label: string; positive: boolean };
  /** Plain muted line below the number — non-delta context (e.g. "Day 12 MTD"). */
  sub?: string;
  projection?: string;
  highlight?: boolean;
  info?: { title: string; formula?: string; source?: string; note?: string };
}

function KpiCard({ label, value, valueNegative, delta, sub, projection, highlight, info }: KpiCardProps) {
  // Paper-white floating stat tile — soft shadow instead of a hairline
  // border, deliberately distinct from the bordered white "container" cards
  // (tables, panels) elsewhere on the dashboard, so a glanceable number and
  // a detailed data table don't carry equal visual weight. The single most
  // important metric gets a colored left accent instead of a heavier border,
  // keeping the emphasis without adding a box.
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${highlight ? "border-l-4 border-[#F15B27]" : "border border-gray-100"}`}>
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gray-50 text-gray-400 mb-2">
        <KpiIcon />
      </span>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
        <span className="flex items-center">
          {label}
          {info && <InfoPopover {...info} />}
        </span>
        {delta && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-normal normal-case ${
            delta.positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
          }`}>
            {delta.label}
          </span>
        )}
      </p>
      {/* Negative = red, everything else = neutral — same convention as the
          P&L table below it, so a loss reads the same way in both places. */}
      <p className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${valueNegative ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      {sub && (
        <p className="mt-0.5 text-xs font-medium text-gray-400">{sub}</p>
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
        delta={revDelta ?? undefined}
        sub={!revDelta ? mtdLabel : undefined}
        projection={projRev}
        info={{ title: "Total Revenue", formula: "Workspace Rental + Meeting Space + Package Revenue + Member Amenities + Membership + Registration & Access + Miscellaneous", source: "Yardi Scheduler_Reports — 12-Month Income Statement" }}
      />
      <KpiCard
        label="Net Margin"
        value={`${netMargin.toFixed(1)}%`}
        valueNegative={netMargin < 0}
        delta={netMarginDelta ? { label: `${netMarginDelta.diff >= 0 ? "+" : ""}${netMarginDelta.diff.toFixed(1)}pp`, positive: netMarginDelta.positive } : undefined}
        sub={!netMarginDelta ? mtdLabel : undefined}
        info={{ title: "Net Margin", formula: "Net Income ÷ Total Revenue", source: "Yardi Scheduler_Reports", note: "The bottom-line profitability rate — what share of every revenue dollar the location actually keeps after all expenses." }}
      />
      <KpiCard
        label="Net Income"
        value={fmt(ni)}
        valueNegative={ni < 0}
        delta={niDelta ?? undefined}
        sub={!niDelta ? mtdLabel : undefined}
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
        value={formatCurrency(revBudgetVariance, { compact: true, showSign: true })}
        delta={vsBudgetRevPct !== null ? { label: `${vsBudgetRevPct >= 0 ? "+" : ""}${vsBudgetRevPct.toFixed(1)}%`, positive: vsBudgetRevPct >= 0 } : undefined}
        sub={vsBudgetRevPct === null ? "vs full-month budget" : undefined}
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
        sub={niMissTooSmallForPct ? "budget too small for a % — showing $ miss" : vsBudgetNi === null ? budgetNote : undefined}
        delta={vsBudgetNi !== null ? undefined : niMissTooSmallForPct ? { label: ni >= proratedNiBudget ? "on plan" : "miss", positive: ni >= proratedNiBudget } : undefined}
        valueNegative={vsBudgetNi !== null ? vsBudgetNi < 0 : niMissTooSmallForPct ? ni < proratedNiBudget : false}
        highlight
        info={{ title: "Net Income vs Budget", formula: isPartial ? `(MTD NI − NI Budget × ${Math.round(effectivePacing * 100)}%) ÷ |Prorated NI Budget|` : "(NI − Full-Month NI Budget) ÷ |NI Budget|", source: "NI budget from Yardi Budget Comparison export (account 9900)", note: `Primary profitability-vs-plan signal now that NOI is no longer shown separately. Below a $${PCT_DENOMINATOR_FLOOR.toLocaleString()} budget, the % swings wildly (a small-dollar miss reads as +1000%+), so the $ miss is shown instead.` }}
      />
      </div>
    </div>
    </div>
  );
}
