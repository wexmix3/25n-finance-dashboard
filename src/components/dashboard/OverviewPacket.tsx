"use client";

import { useSyncExternalStore } from "react";
import type { Location, FinancialData, OccupancyData, TrendPoint, MonthlyPacket, LineItem, MonthlyRecord } from "@/types/dashboard";
import { formatCurrency, formatSignedPct, MARGIN_REVENUE_FLOOR } from "@/lib/formatCurrency";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell as PieCell,
} from "recharts";

interface Props {
  location: Location;
  currentData: FinancialData;
  priorData: FinancialData | null;
  /** Every month on file for this location -- used to compute YTD figures
   * on the KPI strip (Christine's "add YTD to these boxes" request). Same
   * source and same year-to-date-through-current-month definition as
   * LocationSummaryTable's Consolidated YTD row, so the two can't disagree. */
  records: MonthlyRecord[];
  occupancy: OccupancyData | null;
  priorOccupancy: OccupancyData | null;
  /** Up to 12 months, chronological, ending at the currently viewed period. */
  trend: TrendPoint[];
  /** Same month keys as `trend`, occupancy_pct only — merged in by month below. */
  occupancyTrend: { month: string; occupancy_pct: number | null }[];
  /** Space-type occupancy mix (Dedicated Desk / Private Office / etc.) for
   * every month on file, not just the currently-viewed one — Christine's
   * "Missing the Occupancy mix for all prior periods" request, 2026-08-25. */
  occupancyMixTrend: { month: string; mix: { label: string; value: number }[] }[];
  /** Latest generated packet for this location — Balance Sheet section only
   * renders when its month matches the period being viewed, since packets
   * aren't generated per historical period the way financials are. */
  packet: MonthlyPacket | null;
  locked: boolean;
  uploadedAt?: string;
  pacingPct: number | null;
}

const BRAND = "#F15B27";
const NEG = "#dc2626";
const MIX_COLORS = ["#F15B27", "#f5a15a", "#2c5a82", "#6b9bc3", "#9aa5b1", "#c9cfd6"];

// Same year-to-date-through-current-month definition as LocationSummaryTable's
// computeYTD, extended to opex since the KPI strip needs a Total Expenses
// YTD figure that table doesn't.
function computeYTDTotals(records: MonthlyRecord[], currentMonth: string): { revenue: number; opex: number; opNI: number } | null {
  const [, yearStr] = currentMonth.split(" ");
  if (!yearStr) return null;
  const ytdRecords = records.filter(r => r.month.endsWith(yearStr));
  if (ytdRecords.length === 0) return null;
  return ytdRecords.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.data?.income_statement?.revenue?._total?.actual ?? 0),
      opex: acc.opex + (r.data?.income_statement?.opex?._total?.actual ?? 0),
      opNI: acc.opNI + (r.data?.income_statement?.net_operating_income?.actual ?? 0),
    }),
    { revenue: 0, opex: 0, opNI: 0 }
  );
}

// Same five core space types the Occupancy tab already scores into
// occupancy_pct (Day Office / Meeting Rooms excluded there too). Exported so
// the Consolidated call site can build the same mix for every historical
// month, not just the one currently viewed.
const CORE_TYPE_PREFIXES = ["Dedicated Desk", "Private Office", "Full Floor Office", "Office Suite", "Team Office"];
export function computeOccupancyMix(raw: {
  space_breakdown?: { space_type: string; occupancy_rate: number }[];
  dedicated_desk_pct?: number | null;
  private_office_pct?: number | null;
} | undefined): { label: string; value: number }[] {
  const spaceBreakdown = raw?.space_breakdown;
  if (spaceBreakdown && spaceBreakdown.length > 0) {
    return spaceBreakdown
      .filter(sb => CORE_TYPE_PREFIXES.some(p => sb.space_type.startsWith(p)))
      .map(sb => ({ label: sb.space_type, value: Math.round(sb.occupancy_rate * 1000) / 10 }));
  }
  // No unit-level breakdown for this month (locked historical rows sourced
  // from Christine's "Consolidated Dashboard 8.1.2026.xlsx" via Tracey --
  // rate-only, no unit counts). Fall back to the rate fields rather than
  // showing blank; still Christine-verified, just a coarser shape.
  const mix: { label: string; value: number }[] = [];
  if (raw?.dedicated_desk_pct != null) mix.push({ label: "Dedicated Desk", value: raw.dedicated_desk_pct });
  if (raw?.private_office_pct != null) mix.push({ label: "Private Office", value: raw.private_office_pct });
  return mix;
}

// History-table-only variant of computeOccupancyMix -- rolls multi-room
// entries (Schaumburg's "Private Office - Huddle Up" / "- Amara Club") up
// to their base type so a month with room-level detail lines up with a
// locked historical month that only has the coarser dedicated_desk_pct/
// private_office_pct rate. The current-period donut keeps full room detail
// via computeOccupancyMix() above -- this rollup is only for the
// month-over-month history table, where mismatched labels made two
// non-overlapping columns look like missing data (2026-08-25).
export function computeOccupancyMixRollup(raw: {
  space_breakdown?: { space_type: string; occupancy_rate: number; total_units?: number; occupied_units?: number }[];
  dedicated_desk_pct?: number | null;
  private_office_pct?: number | null;
} | undefined): { label: string; value: number }[] {
  const spaceBreakdown = raw?.space_breakdown;
  if (spaceBreakdown && spaceBreakdown.length > 0) {
    const groups = new Map<string, { occupied: number; total: number }>();
    for (const sb of spaceBreakdown) {
      const base = CORE_TYPE_PREFIXES.find(p => sb.space_type.startsWith(p));
      if (!base) continue;
      const g = groups.get(base) ?? { occupied: 0, total: 0 };
      g.occupied += sb.occupied_units ?? 0;
      g.total += sb.total_units ?? 0;
      groups.set(base, g);
    }
    return Array.from(groups.entries()).map(([label, g]) => ({
      label,
      value: g.total > 0 ? Math.round((g.occupied / g.total) * 1000) / 10 : 0,
    }));
  }
  return computeOccupancyMix(raw);
}

function fmt(n: number | undefined | null, compact = false): string {
  if (n == null) return "—";
  return formatCurrency(n, { compact, zeroDash: false });
}

function pct(n: number | undefined | null, digits = 1): string {
  if (n == null) return "—";
  return `${n.toFixed(digits)}%`;
}

/** Accounting-style percent: negatives in parentheses, matching fmt(). */
function pctAcct(n: number | undefined | null, digits = 1): string {
  if (n == null) return "—";
  return n < 0 ? `(${Math.abs(n).toFixed(digits)}%)` : `${n.toFixed(digits)}%`;
}

function cellClass(n: number | undefined | null): string {
  return n != null && n < 0 ? "text-red-600" : "text-gray-800";
}

/** Live "updated Xm ago" clock — self-contained so the parent doesn't need
 * to thread an impure clock read through props. Same useSyncExternalStore
 * pattern as DashboardClient's daysStale/occHoursStale (server snapshot is
 * null, no reliable "now" during SSR); the subscribe callback ticks every
 * 30s so the badge visibly counts up while the period is open, reinforcing
 * that this page is live rather than a static export. */
function useMinutesAgo(uploadedAt: string | undefined): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, 30_000);
      return () => clearInterval(id);
    },
    () => (uploadedAt ? Math.floor((Date.now() - new Date(uploadedAt).getTime()) / 60000) : null),
    () => null
  );
}

function freshnessLabel(mins: number | null): string {
  if (mins == null) return "";
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated ${Math.floor(hrs / 24)}d ago`;
}

function SectionBand({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#F15B27] text-white px-4 sm:px-5 py-2 rounded-t-xl">
      <span className="flex items-center justify-center w-5 h-5 rounded bg-white/20 text-[11px] font-bold flex-shrink-0">{n}</span>
      <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl overflow-x-auto">{children}</div>;
}

export function OverviewPacket({
  location, currentData, priorData, occupancy, priorOccupancy, trend, occupancyTrend, occupancyMixTrend, packet, locked, uploadedAt, pacingPct, records,
}: Props) {
  const is = currentData.income_statement;
  const rev = is.revenue;
  const opex = is.opex;
  const mins = useMinutesAgo(uploadedAt);

  const ytd = computeYTDTotals(records, currentData.month);

  const totalIncome = rev._total.actual;
  const totalExpenses = opex._total.actual;
  const opNI = is.net_operating_income.actual;
  const priorOpNI = priorData?.income_statement.net_operating_income.actual;

  // Normalize partial-month expenses to a full-month run rate before using
  // them as a burn-rate denominator -- dividing cash by a partial month's
  // spend otherwise overstates "months of cash" the earlier in the month
  // it's viewed (Christine flagged 2026-08-25).
  const monthlyBurn = pacingPct && pacingPct > 0 && pacingPct < 1 ? totalExpenses / pacingPct : totalExpenses;

  const bsSummary = packet?.data.balance_sheet && !packet.data.balance_sheet.error
    ? packet.data.balance_sheet.summary
    : null;
  const currentAssets = bsSummary ? bsSummary.cash_and_bank + bsSummary.receivables + bsSummary.prepaid_and_other : null;
  const currentRatio = bsSummary && bsSummary.current_liabilities !== 0 ? currentAssets! / bsSummary.current_liabilities : null;
  const workingCapital = bsSummary ? currentAssets! - bsSummary.current_liabilities : null;

  // Monthly bar-chart data — last 7 periods ending at the one being viewed.
  const barData = trend.slice(-7).map(t => ({ month: t.month.split(" ")[0], noi: t.noi }));

  // Revenue mix — group anything under 2% of income into "Other" so the
  // donut stays legible instead of a ring of unreadable slivers. Sorted
  // highest $ to lowest (Christine's 2026-08-24 ask) before grouping, so
  // "Other" (grouped small slices) still lands last regardless.
  const revenueLines: { label: string; value: number }[] = [
    { label: "Workspace Rental", value: rev.workspace_rental.actual },
    { label: "Meeting Space", value: rev.meeting_space.actual },
    { label: "Package Revenue", value: rev.package_revenue.actual },
    { label: "Membership Income", value: rev.membership.actual },
    { label: "Member Amenities", value: rev.member_amenities.actual },
    { label: "Registration & Access", value: rev.registration_access.actual },
    { label: "Miscellaneous", value: rev.miscellaneous.actual },
  ].sort((a, b) => b.value - a.value);
  const revenueMixChart = groupSmallSlices(revenueLines, totalIncome);

  // Operating expense mix — same sort, highest $ to lowest.
  const opexLines: { label: string; value: number }[] = [
    { label: "Staffing Costs", value: opex.payroll.actual },
    { label: "Facilities", value: opex.facilities.actual },
    { label: "Insurance", value: opex.insurance.actual },
    { label: "Professional Fees", value: opex.professional_fees.actual },
    { label: "Bad Debt", value: opex.bad_debt.actual },
    { label: "Depreciation", value: opex.depreciation.actual },
    { label: "License & Business Fees", value: opex.license_business_fees.actual },
    { label: "Marketing", value: opex.marketing.actual },
    // Travel + Meals & Entertainment combined into one line per Christine's
    // 2026-08-25 request.
    { label: "Travel", value: opex.travel.actual + opex.meals_entertainment.actual },
    { label: "Office Equipment & Supplies", value: opex.office_supplies.actual },
    { label: "Technology", value: opex.technology.actual },
    { label: "Utilities", value: opex.utilities.actual },
    { label: "Other", value: opex.other.actual },
  ].sort((a, b) => b.value - a.value);

  // Occupancy mix — same five core space types the Occupancy tab already
  // scores into occupancy_pct (Day Office / Meeting Rooms excluded there too).
  const occMixChart = computeOccupancyMix(occupancy?.raw);

  const occDeltaVal = occupancy?.occupancy_pct != null && priorOccupancy?.occupancy_pct != null
    ? Math.round(occupancy.occupancy_pct - priorOccupancy.occupancy_pct)
    : null;

  const isPartial = pacingPct !== null && pacingPct < 1;

  return (
    <div className="space-y-5">
      {/* Title band */}
      <div className="bg-[#F15B27] text-white rounded-xl px-5 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">25N {location}{location === "Frisco" ? " LLC" : ""}</h2>
          <p className="text-xs sm:text-[13px] text-white/85 italic mt-0.5">
            Financial Dashboard — For the Period {isPartial ? "Through" : "Ending"} {currentData.month}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
              Locked — Final
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Live{mins != null ? ` · ${freshnessLabel(mins)}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="bg-white border border-gray-200 rounded-xl grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-gray-100">
        <KpiTile label="Cash Balance" value={bsSummary ? fmt(bsSummary.cash_and_bank) : "—"} sub={bsSummary ? undefined : "no packet for this period"} tone="pos" />
        <KpiTile label="Op. Net Income (PTD)" value={fmt(opNI)} sub={priorOpNI != null ? momLabel(opNI, priorOpNI) : undefined} ytd={ytd ? `YTD ${fmt(ytd.opNI, true)}` : undefined} tone={opNI < 0 ? "neg" : "neutral"} />
        <KpiTile label="Total Income (PTD)" value={fmt(totalIncome)} ytd={ytd ? `YTD ${fmt(ytd.revenue, true)}` : undefined} tone="neutral" />
        <KpiTile label="Total Expenses (PTD)" value={fmt(totalExpenses)} ytd={ytd ? `YTD ${fmt(ytd.opex, true)}` : undefined} tone="neutral" />
        <KpiTile
          label="Occupancy (PTD)"
          value={occupancy?.occupancy_pct != null ? `${occupancy.occupancy_pct}%` : "—"}
          sub={occDeltaVal != null ? `${occDeltaVal >= 0 ? "+" : "("}${Math.abs(occDeltaVal)}${occDeltaVal < 0 ? "%)" : "%"} MoM` : undefined}
          ytd={occupancy?.raw.ytd_occupancy_pct != null ? `YTD ${occupancy.raw.ytd_occupancy_pct}%` : undefined}
          tone="brand"
        />
      </div>

      {/* Chart trio */}
      <div className="bg-white border border-gray-200 rounded-xl grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
        <div className="p-4">
          <p className="text-xs font-bold text-gray-700 text-center mb-2">Operating Net Income by Month</p>
          {barData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v: number) => fmt(v, true)} tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={44} />
                <RTooltip formatter={(v) => fmt(Number(v ?? 0))} labelStyle={{ fontSize: 11, fontWeight: 600 }} contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 8 }} />
                <Bar dataKey="noi" radius={[3, 3, 0, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.noi < 0 ? NEG : BRAND} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart label="Needs 2+ months of data" />}
        </div>
        <div className="p-4">
          <p className="text-xs font-bold text-gray-700 text-center mb-2">{currentData.month} Revenue Mix</p>
          {totalIncome !== 0 ? <MixDonut data={revenueMixChart} /> : <EmptyChart label="No revenue this period" />}
        </div>
        <div className="p-4">
          <p className="text-xs font-bold text-gray-700 text-center mb-2">Occupancy Mix by Space Type</p>
          {occMixChart.length > 0 ? <MixDonut data={occMixChart} suffix="%" /> : <EmptyChart label="No occupancy breakdown yet" />}
        </div>
      </div>

      <OccupancyMixHistory trend={occupancyMixTrend} />

      {/* 1. Liquidity & Solvency */}
      <div>
        <SectionBand n={1} title="Liquidity & Solvency" />
        <SectionShell>
          {bsSummary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-gray-100"><th className="text-left font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">&nbsp;</th><th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">Balance</th></tr></thead>
                <tbody>
                  <Row label="Cash & Bank" value={fmt(bsSummary.cash_and_bank)} />
                  <Row label="Receivables" value={fmt(bsSummary.receivables)} />
                  <Row label="Total Assets" value={fmt(bsSummary.total_assets)} />
                  <Row label="Current Liabilities" value={fmt(bsSummary.current_liabilities)} />
                  <Row label="Long-Term Liabilities" value={fmt(bsSummary.long_term_liabilities)} />
                  <Row label="Total Equity" value={fmt(bsSummary.equity)} bold last />
                </tbody>
              </table>
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-gray-100"><th className="text-left font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">Metric</th><th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">&nbsp;</th></tr></thead>
                <tbody>
                  <Row label="Current Ratio" value={currentRatio != null ? `${currentRatio.toFixed(2)}x` : "—"} />
                  <Row label="Working Capital" value={fmt(workingCapital)} />
                  <Row label="Cash as % of Current Liabilities" value={bsSummary.current_liabilities !== 0 ? pct((bsSummary.cash_and_bank / bsSummary.current_liabilities) * 100) : "—"} />
                  <Row label="Operating Margin (PTD)" value={Math.abs(totalIncome) >= MARGIN_REVENUE_FLOOR ? pctAcct((opNI / totalIncome) * 100) : "N/A · low revenue"} />
                  <Row label="Months of Cash at Current Burn" value={monthlyBurn > 0 ? `${(bsSummary.cash_and_bank / monthlyBurn).toFixed(1)}` : "—"} />
                  <Row label="Balance Sheet Check (A = L + C)" value={Math.abs(bsSummary.balance_check) < 1 ? "OK" : fmt(bsSummary.balance_check)} bold last positive={Math.abs(bsSummary.balance_check) < 1} />
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400 px-5 py-6">
              No Balance Sheet packet on file for {currentData.month}. Generate a Financial Packet for this period to populate this section.
            </p>
          )}
        </SectionShell>
      </div>

      {/* 2. Profitability & Occupancy Trend — every month in `trend` gets a
          column (not sliced) so the section title's claimed range always
          matches what's actually shown. Previously sliced to the last 7,
          which silently dropped Jan off the left edge once 8 months of 2026
          data existed while the title still said "Jan 2026 – Aug 2026" —
          exactly what Christine flagged as "missing January." SectionShell
          already scrolls horizontally for wide tables. */}
      <div>
        <SectionBand n={2} title={`Profitability & Occupancy Trend (${trend.length >= 2 ? `${trend[0].month} – ${trend[trend.length - 1].month}` : currentData.month})`} />
        <SectionShell>
          {trend.length >= 2 ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">&nbsp;</th>
                  {trend.map(t => <th key={t.month} className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2 whitespace-nowrap">{t.month.split(" ")[0]}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="px-4 sm:px-5 py-2 text-gray-700">Total Income</td>
                  {trend.map(t => <td key={t.month} className="text-right px-4 sm:px-5 py-2 tabular-nums text-gray-800">{fmt(t.revenue)}</td>)}
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="px-4 sm:px-5 py-2 font-bold text-gray-900">Operating Net Income</td>
                  {trend.map(t => <td key={t.month} className={`text-right px-4 sm:px-5 py-2 tabular-nums font-bold ${cellClass(t.noi)}`}>{fmt(t.noi)}</td>)}
                </tr>
                <tr>
                  <td className="px-4 sm:px-5 py-2 text-[#F15B27] font-semibold">Occupancy %</td>
                  {trend.map(t => {
                    const o = occupancyTrend.find(x => x.month === t.month)?.occupancy_pct ?? null;
                    return <td key={t.month} className="text-right px-4 sm:px-5 py-2 tabular-nums text-gray-800">{o != null ? `${Math.round(o)}%` : "—"}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-400 px-5 py-6">Needs at least two months of data to show a trend.</p>
          )}
        </SectionShell>
      </div>

      {/* 3. Performance vs Budget and Prior Month */}
      <div>
        <SectionBand n={3} title="Performance vs Budget and Prior Month (Period to Date)" />
        <SectionShell>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">&nbsp;</th>
                <th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">{currentData.month.split(" ")[0]} Actual</th>
                <th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">{currentData.month.split(" ")[0]} Budget</th>
                <th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">Var $</th>
                <th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">Var %</th>
                {priorData && <>
                  <th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">{priorData.month.split(" ")[0]} Actual</th>
                  <th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">MoM $</th>
                  <th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">MoM %</th>
                </>}
              </tr>
            </thead>
            <tbody>
              <BudgetRow label="Total Income" line={rev._total} prior={priorData?.income_statement.revenue._total} />
              <BudgetRow label="Cost of Sales" line={is.cos._total} prior={priorData?.income_statement.cos._total} isExpense />
              <BudgetRow label="Gross Profit" line={is.gross_profit} prior={priorData?.income_statement.gross_profit} />
              <BudgetRow label="Total Expenses" line={opex._total} prior={priorData?.income_statement.opex._total} isExpense />
              <BudgetRow label="Operating Net Income" line={is.net_operating_income} prior={priorData?.income_statement.net_operating_income} bold last />
            </tbody>
          </table>
        </SectionShell>
      </div>

      {/* 4. Revenue Mix */}
      <div>
        <SectionBand n={4} title="Revenue Mix (Period to Date)" />
        <SectionShell>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-gray-100"><th className="text-left font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">&nbsp;</th><th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">{currentData.month.split(" ")[0]} Actual</th><th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">% of Income</th></tr></thead>
            <tbody>
              {revenueLines.map(l => (
                <Row key={l.label} label={l.label} value={fmt(l.value)} pctVal={totalIncome !== 0 ? pct((l.value / totalIncome) * 100) : "—"} />
              ))}
              <Row label="Total Income" value={fmt(totalIncome)} pctVal="100.0%" bold last />
            </tbody>
          </table>
        </SectionShell>
      </div>

      {/* 5. Operating Expense Mix */}
      <div>
        <SectionBand n={5} title="Operating Expense Mix (Period to Date)" />
        <SectionShell>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-gray-100"><th className="text-left font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">&nbsp;</th><th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">{currentData.month.split(" ")[0]} Actual</th><th className="text-right font-semibold text-gray-400 text-[10.5px] uppercase px-4 sm:px-5 py-2">% of Expenses</th></tr></thead>
            <tbody>
              {opexLines.map(l => (
                <Row key={l.label} label={l.label} value={fmt(l.value)} pctVal={totalExpenses !== 0 ? pct((l.value / totalExpenses) * 100) : "—"} />
              ))}
              <Row label="Total Operating Expenses" value={fmt(totalExpenses)} pctVal="100.0%" bold last />
            </tbody>
          </table>
        </SectionShell>
      </div>

      <p className="text-[11px] italic text-gray-400 px-1">
        Sections ordered by investor priority: liquidity and solvency first, then profitability and occupancy trajectory, budget performance, revenue quality, and cost structure. Figures pull live from the same GL and Kube data feeding GL Check and the Occupancy tab — nothing here is a separate copy.
      </p>
    </div>
  );
}

/** Compact space-type-by-month table below the current-period donut --
 * shows every month that has mix data on file, not just the one selected. */
function OccupancyMixHistory({ trend }: { trend: { month: string; mix: { label: string; value: number }[] }[] }) {
  const populated = trend.filter(t => t.mix.length > 0);
  if (populated.length < 2) return null;

  const labels = Array.from(new Set(populated.flatMap(t => t.mix.map(m => m.label))));
  const lastMonth = populated[populated.length - 1].month;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-bold text-gray-700 mb-3">Occupancy Mix by Space Type — History</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] min-w-[420px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left font-semibold text-gray-400 text-[10.5px] uppercase px-2 py-1.5">Space Type</th>
              {populated.map(t => (
                <th key={t.month} className={`text-right font-semibold text-[10.5px] uppercase px-2 py-1.5 ${t.month === lastMonth ? "text-[#F15B27]" : "text-gray-400"}`}>
                  {t.month.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map(label => (
              <tr key={label} className="border-b border-gray-50 last:border-0">
                <td className="px-2 py-1.5 text-gray-700">{label}</td>
                {populated.map(t => {
                  const v = t.mix.find(m => m.label === label)?.value;
                  return (
                    <td key={t.month} className={`text-right tabular-nums px-2 py-1.5 ${t.month === lastMonth ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                      {v != null ? `${v}%` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function momLabel(current: number, prior: number): string {
  if (!prior) return "";
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  return `${formatSignedPct(pct)} MoM`;
}

function groupSmallSlices(lines: { label: string; value: number }[], total: number): { label: string; value: number }[] {
  if (total === 0) return [];
  const threshold = Math.abs(total) * 0.02;
  const big = lines.filter(l => Math.abs(l.value) >= threshold);
  const small = lines.filter(l => Math.abs(l.value) < threshold);
  const otherSum = small.reduce((s, l) => s + l.value, 0);
  return otherSum !== 0 ? [...big, { label: "Other", value: otherSum }] : big;
}

function MixDonut({ data, suffix }: { data: { label: string; value: number }[]; suffix?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0" style={{ width: 100, height: 100 }}>
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={28} outerRadius={46} paddingAngle={1.5}>
              {data.map((_, i) => <PieCell key={i} fill={MIX_COLORS[i % MIX_COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-1 text-[10.5px] text-gray-600 min-w-0">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: MIX_COLORS[i % MIX_COLORS.length] }} />
            <span className="truncate">{d.label}</span>
            <span className="ml-auto font-semibold text-gray-800 tabular-nums flex-shrink-0">{suffix ? `${d.value}${suffix}` : `${((d.value / data.reduce((s, x) => s + x.value, 0)) * 100).toFixed(0)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-[100px] flex items-center justify-center text-[11px] text-gray-400 text-center px-2">{label}</div>;
}

function KpiTile({ label, value, sub, ytd, tone }: { label: string; value: string; sub?: string; ytd?: string; tone: "pos" | "neg" | "neutral" | "brand" }) {
  const valueColor = tone === "neg" ? "text-red-600" : tone === "brand" ? "text-[#F15B27]" : tone === "pos" ? "text-emerald-700" : "text-gray-900";
  return (
    <div className="px-3 sm:px-4 py-3.5 text-center">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg sm:text-xl font-extrabold tabular-nums mt-1 ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10.5px] text-gray-400 mt-0.5 tabular-nums">{sub}</p>}
      {ytd && <p className="text-[10.5px] text-gray-400 tabular-nums">{ytd}</p>}
    </div>
  );
}

function Row({ label, value, pctVal, bold, last, positive }: { label: string; value: string; pctVal?: string; bold?: boolean; last?: boolean; positive?: boolean }) {
  return (
    <tr className={last ? "border-t border-gray-200" : "border-b border-gray-50"}>
      <td className={`px-4 sm:px-5 py-2 ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>{label}</td>
      <td className={`text-right px-4 sm:px-5 py-2 tabular-nums ${bold ? "font-bold" : ""} ${positive ? "text-emerald-700" : value.startsWith("(") ? "text-red-600" : "text-gray-800"}`}>{value}</td>
      {pctVal !== undefined && <td className={`text-right px-4 sm:px-5 py-2 tabular-nums text-gray-500 ${bold ? "font-bold" : ""}`}>{pctVal}</td>}
    </tr>
  );
}

// Variance/MoM columns are a favorability signal, not a raw-value sign check
// -- for an expense line, coming in under budget (negative variance) is
// favorable and should NOT be red. Christine flagged this exact reversal on
// Cost of Sales / Total Expenses 2026-08-25 ("lower current-period costs
// than the prior period/budget are positive/favorable, not negative").
function varianceClass(n: number | undefined | null, isExpense: boolean): string {
  if (n == null) return "text-gray-800";
  const unfavorable = isExpense ? n > 0 : n < 0;
  return unfavorable ? "text-red-600" : "text-gray-800";
}

function BudgetRow({ label, line, prior, bold, last, isExpense = false }: { label: string; line: LineItem; prior?: LineItem; bold?: boolean; last?: boolean; isExpense?: boolean }) {
  const varPct = line.budget !== 0 ? (line.variance / Math.abs(line.budget)) * 100 : null;
  const mom = prior ? line.actual - prior.actual : null;
  const momPct = prior && prior.actual !== 0 ? (mom! / Math.abs(prior.actual)) * 100 : null;
  return (
    <tr className={last ? "border-t border-gray-200" : "border-b border-gray-50"}>
      <td className={`px-4 sm:px-5 py-2 ${bold ? "font-bold text-gray-900" : "text-gray-700"}`}>{label}</td>
      <td className={`text-right px-4 sm:px-5 py-2 tabular-nums ${bold ? "font-bold" : ""} ${cellClass(line.actual)}`}>{fmt(line.actual)}</td>
      <td className="text-right px-4 sm:px-5 py-2 tabular-nums text-gray-600">{fmt(line.budget)}</td>
      <td className={`text-right px-4 sm:px-5 py-2 tabular-nums ${varianceClass(line.variance, isExpense)}`}>{fmt(line.variance)}</td>
      <td className={`text-right px-4 sm:px-5 py-2 tabular-nums ${varianceClass(varPct, isExpense)}`}>{pctAcct(varPct)}</td>
      {prior && <>
        <td className="text-right px-4 sm:px-5 py-2 tabular-nums text-gray-600">{fmt(prior.actual)}</td>
        <td className={`text-right px-4 sm:px-5 py-2 tabular-nums ${varianceClass(mom, isExpense)}`}>{fmt(mom)}</td>
        <td className={`text-right px-4 sm:px-5 py-2 tabular-nums ${varianceClass(momPct, isExpense)}`}>{pctAcct(momPct)}</td>
      </>}
    </tr>
  );
}
