import { FinancialData } from "@/types/dashboard";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { formatCurrency, formatMarginPct, MARGIN_REVENUE_FLOOR } from "@/lib/formatCurrency";

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
  /** "vs last" / "vs budget" — a light tag replacing the old full-height
   * divider + separate group headers, so 5 cards read as one row with two
   * conceptually grouped ends instead of two uneven groups (3-card / 2-card)
   * split by a hard rule. */
  groupLabel?: string;
}

function KpiCard({ label, value, valueNegative, delta, sub, projection, highlight, info, groupLabel }: KpiCardProps) {
  // Paper-white floating stat tile — soft shadow instead of a hairline
  // border, deliberately distinct from the bordered white "container" cards
  // (tables, panels) elsewhere on the dashboard, so a glanceable number and
  // a detailed data table don't carry equal visual weight. The single most
  // important metric gets a colored left accent instead of a heavier border,
  // keeping the emphasis without adding a box.
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${highlight ? "border-l-4 border-[#F15B27]" : "border border-gray-100"}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
        <span className="flex items-center">
          {label}
          {info && <InfoPopover {...info} />}
        </span>
        {groupLabel && (
          <span className="text-[9px] font-semibold text-gray-300 normal-case tracking-normal">{groupLabel}</span>
        )}
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
  const netMarginTooSmall = Math.abs(rev) < MARGIN_REVENUE_FLOOR;

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

  // Unified grid — was two uneven groups (3-card "vs last" / 2-card
  // "vs budget") split by a full-height vertical rule that landed at an odd
  // point in the row. Now one grid of 5 cards, each carrying a light "vs
  // last" / "vs budget" tag next to its label instead of a hard divider.
  // Capped at 3 columns (wraps to a 3+2 layout) rather than forcing all 5
  // across — this component now lives in the Overview's right-hand column
  // (finding #11's 2-col layout), which is roughly half page width, so a
  // fixed 5-across grid would overflow its container at desktop widths.
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <KpiCard
        label="Revenue"
        groupLabel="vs last"
        value={fmt(rev)}
        valueNegative={rev < 0}
        delta={revDelta ?? undefined}
        sub={!revDelta ? mtdLabel : undefined}
        projection={projRev}
        info={{ title: "Total Revenue", formula: "Workspace Rental + Meeting Space + Package Revenue + Member Amenities + Membership + Registration & Access + Miscellaneous", source: "Yardi Scheduler_Reports — 12-Month Income Statement" }}
      />
      <KpiCard
        label="Net Margin"
        groupLabel="vs last"
        value={formatMarginPct(netMargin, rev)}
        valueNegative={!netMarginTooSmall && netMargin < 0}
        delta={!netMarginTooSmall ? (netMarginDelta ? { label: `${netMarginDelta.diff >= 0 ? "+" : ""}${netMarginDelta.diff.toFixed(1)}pp`, positive: netMarginDelta.positive } : undefined) : undefined}
        sub={netMarginTooSmall ? "revenue too small for a % — see $ figures" : !netMarginDelta ? mtdLabel : undefined}
        info={{ title: "Net Margin", formula: "Net Income ÷ Total Revenue", source: "Yardi Scheduler_Reports", note: `The bottom-line profitability rate — what share of every revenue dollar the location actually keeps after all expenses. Below $${MARGIN_REVENUE_FLOOR.toLocaleString()} of revenue, the % swings wildly, so a low-revenue notice is shown instead.` }}
      />
      <KpiCard
        label="Net Income"
        groupLabel="vs last"
        value={fmt(ni)}
        valueNegative={ni < 0}
        delta={niDelta ?? undefined}
        sub={!niDelta ? mtdLabel : undefined}
        info={{ title: "Net Income", formula: "NOI + Other Income − Other Expenses", source: "Yardi Scheduler_Reports" }}
      />
      <KpiCard
        label="Revenue vs Budget"
        groupLabel="vs budget"
        value={formatCurrency(revBudgetVariance, { compact: true, showSign: true })}
        delta={vsBudgetRevPct !== null ? { label: `${vsBudgetRevPct >= 0 ? "+" : ""}${vsBudgetRevPct.toFixed(1)}%`, positive: vsBudgetRevPct >= 0 } : undefined}
        sub={vsBudgetRevPct === null ? "vs full-month budget" : undefined}
        highlight
        info={{ title: "Revenue vs Budget", formula: "Revenue − Full-Month Budget", source: "Budget from Yardi Budget Comparison export", note: "Most 25N revenue is contractual and posts in full on the 1st, so this is always compared to the full-month budget — never prorated by elapsed days — and shown as a $ variance." }}
      />
      <KpiCard
        label="Net Income vs Budget"
        groupLabel="vs budget"
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
  );
}
