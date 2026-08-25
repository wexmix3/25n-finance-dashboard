"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { LOCATIONS, Location } from "@/types/dashboard";
import type { MonthlyRecord, TrendPoint, FinancialData, OccupancyData, MonthlyPacket, GlItemReview, GlItemNote } from "@/types/dashboard";
import { DashboardShell, LocationTab } from "@/components/dashboard/DashboardShell";
import { PeriodPills } from "@/components/dashboard/PeriodPills";
import { PeriodBanner } from "@/components/dashboard/PeriodBanner";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { OverviewPacket } from "@/components/dashboard/OverviewPacket";
import { OccupancySection, occupancyDeltaLabel, OccupancyTrendChart } from "@/components/dashboard/OccupancySection";
import { OccupancyHistoryTable } from "@/components/dashboard/OccupancyHistoryTable";
import { occupancyMetricValue, type OccupancyMetric } from "@/lib/occupancy";
import { LocationSummaryTable } from "@/components/dashboard/LocationSummaryTable";
import { DataDictionary } from "@/components/dashboard/DataDictionary";
import { GLCheckTab } from "@/components/dashboard/GLCheckTab";
import { AlertBannerStack, AlertBanner, type AlertBannerItem } from "@/components/dashboard/AlertBanner";
import { FinancialPacketTab } from "@/components/dashboard/FinancialPacketTab";
import { formatCurrency } from "@/lib/formatCurrency";

type HealthStatus = "green" | "yellow" | "red" | "gray";

interface LocationData {
  current: MonthlyRecord | null;
  prior: MonthlyRecord | null;
  trend: TrendPoint[];
  occupancy: OccupancyData | null;
  priorOccupancy: OccupancyData | null;
  allRecords: MonthlyRecord[];
  availableMonths: string[];
  allOccupancy: { month: string; data: OccupancyData }[];
  occupancyUploadedAt: string | null;
}

interface Props {
  locationData: Record<Location, LocationData>;
  packetData: Record<Location, MonthlyPacket[]>;
  userEmail: string;
  role: string;
  glItemReviews: GlItemReview[];
  glItemNotes: GlItemNote[];
}

function computeLocPacingPct(month: string, uploadedAt: string): number | null {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [monStr, yearStr] = month.split(" ");
  const monthIdx = monthNames.indexOf(monStr);
  const year = parseInt(yearStr);
  if (monthIdx === -1 || isNaN(year)) return null;
  // UTC throughout — see identical fix + rationale in PeriodBanner.tsx
  // (server runs UTC, browser runs Eastern; local-TZ date methods produced
  // different calendar days for the same timestamp and tripped React #418).
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const uploadDate = new Date(uploadedAt);
  if (uploadDate.getUTCFullYear() === year && uploadDate.getUTCMonth() === monthIdx) {
    return uploadDate.getUTCDate() / daysInMonth;
  }
  return 1;
}

function getPriorMonthLabel(month: string): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [mon, yearStr] = month.split(" ");
  const year = parseInt(yearStr);
  const idx = monthNames.indexOf(mon);
  if (idx === -1 || !yearStr) return "Prior";
  if (idx === 0) return `Dec ${year - 1}`;
  return `${monthNames[idx - 1]} ${year}`;
}

/** Last 6 months of occupancy % ending at the current financial month —
 * same allOccupancy source LocationData already carries, just sliced/mapped
 * for the Occupancy tab's trend chart (finding #7: the tab was mostly empty
 * space below the single stat card). */
function buildOccupancyHistory(
  allOccupancy: { month: string; data: import("@/types/dashboard").OccupancyData }[],
  endMonth: string
): { month: string; occupancy_pct: number | null }[] {
  const sorted = [...allOccupancy].sort((a, b) => monthSortKeyLocal(a.month) - monthSortKeyLocal(b.month));
  const endIdx = sorted.findIndex(o => o.month === endMonth);
  const upto = endIdx >= 0 ? sorted.slice(0, endIdx + 1) : sorted;
  return upto.slice(-6).map(o => ({ month: o.month, occupancy_pct: o.data.occupancy_pct ?? null }));
}

function buildPeriodTrend(allRecords: MonthlyRecord[], endMonth: string): TrendPoint[] {
  const endIdx = allRecords.findIndex(r => r.month === endMonth);
  const slice = endIdx >= 0 ? allRecords.slice(endIdx, endIdx + 12) : allRecords.slice(0, 12);
  return [...slice].reverse().map(r => ({
    month: r.month,
    revenue: r.data?.income_statement?.revenue?._total?.actual ?? 0,
    gp: r.data?.income_statement?.gross_profit?.actual ?? 0,
    noi: r.data?.income_statement?.net_operating_income?.actual ?? 0,
    ni: r.data?.income_statement?.net_income?.actual ?? 0,
  }));
}

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthSortKeyLocal(m: string): number {
  const [mon, yearStr] = m.split(" ");
  const idx = MONTH_ORDER.indexOf(mon);
  const year = parseInt(yearStr, 10);
  if (idx === -1 || isNaN(year)) return -Infinity;
  return year * 12 + idx;
}

/** Portfolio-level aggregate for the Consolidated home — sums only
 * locations that have a current-period record, so a location that hasn't
 * uploaded yet doesn't silently zero out the portfolio total. */
function computePortfolioSnapshot(locationData: Record<Location, LocationData>, month: string | null) {
  let revenue = 0, ni = 0, niBudget = 0, revenueBudget = 0, locationsWithData = 0;
  for (const loc of LOCATIONS) {
    const rec = month ? locationData[loc].allRecords.find(r => r.month === month) : locationData[loc].current;
    const d = rec?.data;
    if (!d) continue;
    locationsWithData++;
    revenue += d.income_statement.revenue._total.actual;
    ni += d.income_statement.net_income.actual;
    niBudget += d.income_statement.net_income.budget;
    revenueBudget += d.income_statement.revenue._total.budget;
  }
  return { revenue, ni, niBudget, revenueBudget, locationsWithData };
}

/** Portfolio trend — same shape as buildPeriodTrend, summed across all 5
 * locations per calendar month instead of one location's own history. */
function computePortfolioTrend(locationData: Record<Location, LocationData>): TrendPoint[] {
  const byMonth = new Map<string, { revenue: number; gp: number; noi: number; ni: number }>();
  for (const loc of LOCATIONS) {
    for (const r of locationData[loc].allRecords) {
      const cur = byMonth.get(r.month) ?? { revenue: 0, gp: 0, noi: 0, ni: 0 };
      cur.revenue += r.data?.income_statement?.revenue?._total?.actual ?? 0;
      cur.gp += r.data?.income_statement?.gross_profit?.actual ?? 0;
      cur.noi += r.data?.income_statement?.net_operating_income?.actual ?? 0;
      cur.ni += r.data?.income_statement?.net_income?.actual ?? 0;
      byMonth.set(r.month, cur);
    }
  }
  return [...byMonth.entries()]
    .sort((a, b) => monthSortKeyLocal(a[0]) - monthSortKeyLocal(b[0]))
    .slice(-12)
    .map(([month, v]) => ({ month, ...v }));
}

function fmtExec(n: number): string {
  return formatCurrency(n, { compact: true, zeroDash: false });
}

/** Portfolio-wide occupancy — simple average across whichever locations
 * have a current Kube occupancy record, so a location that hasn't reported
 * yet doesn't silently zero out the portfolio figure (same guard pattern as
 * computePortfolioSnapshot for financials).
 *
 * Reads through the shared `occupancyMetricValue("total")` helper -- same
 * one the Total Space Occupancy table below uses -- so this hero-card
 * average and that table's bottom-row average can never disagree again.
 * Previously this read `occ?.occupancy_pct` directly and skipped the
 * table's 0%-is-"no data" rule, which is exactly what Christine caught in
 * her 2026-08-24 feedback ("shouldn't these two occupancy % equal each
 * other?") -- confirmed live 2026-08-25: this card and the table disagreed
 * only in months where a location (Uptown) posted a literal 0%. */
function computePortfolioOccupancy(locationData: Record<Location, LocationData>, month: string | null) {
  let sum = 0, count = 0, priorSum = 0, priorCount = 0;
  for (const loc of LOCATIONS) {
    const occ = month
      ? locationData[loc].allOccupancy.find(o => o.month === month)?.data
      : locationData[loc].occupancy;
    const pct = occupancyMetricValue(occ, "total");
    if (pct != null) { sum += pct; count++; }
    const priorMonthStr = month ? getPriorMonthLabel(month) : null;
    const priorOcc = month
      ? locationData[loc].allOccupancy.find(o => o.month === priorMonthStr)?.data
      : locationData[loc].priorOccupancy;
    const priorPct = occupancyMetricValue(priorOcc, "total");
    if (priorPct != null) { priorSum += priorPct; priorCount++; }
  }
  return {
    avg: count > 0 ? sum / count : null,
    count,
    priorAvg: priorCount > 0 ? priorSum / priorCount : null,
  };
}

/** Portfolio occupancy history — average occupancy_pct per month across
 * whichever locations reported that month, 2026 only for now (Christine's
 * 2026-08-19 "historical occupancies" ask — she said stick to 2026, add
 * 2025 later if that data becomes available). Feeds the Consolidated
 * Overview's occupancy trend chart, the same reusable component the
 * per-location Occupancy tab already uses.
 *
 * Reads through `occupancyMetricValue("total")` (same as the hero card and
 * the Total Space Occupancy table) so all three Consolidated occupancy
 * views agree with each other. */
function computePortfolioOccupancyTrend(locationData: Record<Location, LocationData>): { month: string; occupancy_pct: number | null }[] {
  const byMonth = new Map<string, { sum: number; count: number }>();
  for (const loc of LOCATIONS) {
    for (const { month, data } of locationData[loc].allOccupancy) {
      if (!month.endsWith("2026")) continue;
      const pct = occupancyMetricValue(data, "total");
      if (pct == null) continue;
      const cur = byMonth.get(month) ?? { sum: 0, count: 0 };
      cur.sum += pct;
      cur.count += 1;
      byMonth.set(month, cur);
    }
  }
  return [...byMonth.entries()]
    .sort((a, b) => monthSortKeyLocal(a[0]) - monthSortKeyLocal(b[0]))
    .map(([month, { sum, count }]) => ({ month, occupancy_pct: count > 0 ? sum / count : null }));
}

/** Per-location occupancy history, one row per month, for a single metric
 * (Total Space / Private Office / Dedicated Desk) — feeds
 * OccupancyHistoryTable, the per-location breakdown Christine asked for
 * ("the table, not the chart") alongside the existing blended trend chart.
 * Same 2026-only scope and same allOccupancy source as
 * computePortfolioOccupancyTrend above, so none of these views can disagree. */
function computeOccupancyHistoryRows(locationData: Record<Location, LocationData>, metric: OccupancyMetric): { month: string; byLocation: Partial<Record<Location, number | null>> }[] {
  const byMonth = new Map<string, Partial<Record<Location, number | null>>>();
  for (const loc of LOCATIONS) {
    for (const { month, data } of locationData[loc].allOccupancy) {
      if (!month.endsWith("2026")) continue;
      const row = byMonth.get(month) ?? {};
      row[loc] = occupancyMetricValue(data, metric);
      byMonth.set(month, row);
    }
  }
  return [...byMonth.entries()]
    .sort((a, b) => monthSortKeyLocal(a[0]) - monthSortKeyLocal(b[0]))
    .map(([month, byLocation]) => ({ month, byLocation }));
}

/** Boxed headline stat — the Net Income / Occupancy hero pair at the top of
 * every Overview. Both cards share this so the pair reads as one matched
 * row instead of two differently-styled numbers. */
function HeroCard({ label, value, valueNegative, sub }: { label: string; value: string; valueNegative?: boolean; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 h-full">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold tracking-tight tabular-nums text-4xl ${valueNegative ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-sm text-gray-500 mt-1.5">{sub}</p>}
    </div>
  );
}

function NoLocationData({ location, detail }: { location: string; detail: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700">No data for {location}</p>
      <p className="text-xs text-gray-400 mt-1">{detail}</p>
    </div>
  );
}

export function DashboardClient({ locationData, packetData, userEmail, role, glItemReviews, glItemNotes }: Props) {
  // Consolidated is the default landing tab — portfolio health first, drill
  // into a location second, matching how a reader actually approaches "how's
  // the business doing" rather than starting on one arbitrary location.
  const [activeTab, setActiveTab] = useState<LocationTab>("Consolidated");
  const isConsolidated = activeTab === "Consolidated";
  const activeLocation: Location = isConsolidated ? LOCATIONS[0] : activeTab;
  const [selectedMonths, setSelectedMonths] = useState<Partial<Record<Location, string>>>({});
  // Consolidated-only period selector — comparing the same period across all 5
  // locations only makes sense there, so this is scoped separately from the
  // per-location month pills (which stay independent per tab).
  const [consolidatedMonth, setConsolidatedMonth] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "packet" | "gl" | "occupancy">("overview");
  // Instant local override for "mark reviewed" so badges clear immediately
  // without waiting on a full server refetch. Keyed by "location|month".
  const [reviewOverrides, setReviewOverrides] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const locData = locationData[activeLocation];

  const selectedMonth = selectedMonths[activeLocation] ?? null;

  const handleMonthSelect = (month: string) => {
    setSelectedMonths(prev => ({ ...prev, [activeLocation]: month }));
  };

  const consolidatedMonths = Array.from(
    new Set(LOCATIONS.flatMap(loc => locationData[loc].availableMonths))
  );

  // The Consolidated header/hero month label used to be derived through
  // `currentMonth`, which comes from `activeLocation`'s per-location
  // `selectedMonth` state (activeLocation resolves to LOCATIONS[0]/Frisco on
  // the Consolidated tab). That meant switching to Consolidated after
  // picking, say, "Jan 2026" from Frisco's own period pills carried that
  // stale selection over, mislabeling the portfolio header "Portfolio · Jan
  // 2026" even though every actual number shown (computePortfolioSnapshot,
  // computePortfolioOccupancy) was already correctly computed from each
  // location's true latest record — only the label was wrong. Caught via
  // Christine's screenshot, 2026-08-19. This is computed independently of
  // `activeLocation`/`selectedMonth` so it can never inherit a per-location
  // pick again.
  const consolidatedLatestMonth = LOCATIONS.reduce((latest: string | null, loc) => {
    const m = locationData[loc].current?.month;
    if (!m) return latest;
    return !latest || monthSortKeyLocal(m) > monthSortKeyLocal(latest) ? m : latest;
  }, null);
  const consolidatedDisplayMonth = consolidatedMonth ?? consolidatedLatestMonth ?? "—";

  let current: MonthlyRecord | null;
  let prior: MonthlyRecord | null;
  let occupancy: OccupancyData | null;
  let priorOccupancy: OccupancyData | null;

  if (selectedMonth) {
    current = locData.allRecords.find(r => r.month === selectedMonth) ?? null;
    const priorStr = current ? getPriorMonthLabel(current.month) : null;
    prior = priorStr ? locData.allRecords.find(r => r.month === priorStr) ?? null : null;
    occupancy = locData.allOccupancy.find(o => o.month === selectedMonth)?.data ?? null;
    priorOccupancy = priorStr ? locData.allOccupancy.find(o => o.month === priorStr)?.data ?? null : null;
  } else {
    current = locData.current;
    prior = locData.prior;
    // Occupancy is uploaded on its own cadence (Kube tracker), so its most
    // recent record can land on a different month than the most recent
    // financial close — pinning it to the financial month being shown
    // instead of its own independent "latest" avoids a Jun/Jul-style
    // mismatch between the two panels on the same page.
    const currentFinMonth = current?.month;
    occupancy = currentFinMonth
      ? locData.allOccupancy.find(o => o.month === currentFinMonth)?.data ?? null
      : null;
    const priorStr = current ? getPriorMonthLabel(current.month) : null;
    priorOccupancy = priorStr ? locData.allOccupancy.find(o => o.month === priorStr)?.data ?? null : null;
  }

  const currentData: FinancialData | null = current?.data ?? null;
  const priorData: FinancialData | null = prior?.data ?? null;

  const currentMonth = currentData?.month ?? "—";
  const priorMonth = priorData?.month ?? getPriorMonthLabel(currentMonth);

  const uploadedAt = current?.uploaded_at;
  const pacingPct: number | null = uploadedAt && currentMonth !== "—"
    ? computeLocPacingPct(currentMonth, uploadedAt)
    : null;
  const isFullMonth = pacingPct === null || pacingPct >= 1;

  // Period-aware trend: 12 months ending at selected period
  const trendEndMonth = selectedMonth ?? locData.availableMonths[0] ?? "";
  const periodTrend = trendEndMonth ? buildPeriodTrend(locData.allRecords, trendEndMonth) : locData.trend;

  // Health badges — prorated Net Income vs budget per location
  const flagCounts: Partial<Record<Location, number>> = {};
  const healthStatuses: Partial<Record<Location, HealthStatus>> = {};

  for (const loc of LOCATIONS) {
    const rec = locationData[loc].current;
    const d = rec?.data;
    const reviewKey = rec ? `${loc}|${rec.month}` : "";
    const isReviewed = reviewOverrides[reviewKey] ?? rec?.gl_reviewed ?? false;
    const totalIssues = (d?.variance_flags?.length ?? 0) + (d?.control_violations?.length ?? 0) + (d?.journal_entry_accounts?.length ?? 0);
    // Locked periods are closed -- Max's rule (2026-08-23): once a period is
    // locked, its GL issues no longer require action, so they shouldn't
    // drive the "needs review" badge. Only Jul/Aug (the two still-open
    // periods) should ever surface here in normal operation.
    if (totalIssues > 0 && !isReviewed && !rec?.locked) {
      flagCounts[loc] = totalIssues;
    }
    const ni = d?.income_statement?.net_income;
    const c = locationData[loc].current;
    let statusSet = false;
    if (ni && ni.budget !== undefined && ni.budget !== 0 && c?.uploaded_at && c?.month) {
      const locPacing = computeLocPacingPct(c.month, c.uploaded_at);
      if (locPacing !== null) {
        const proratedBudget = ni.budget * locPacing;
        if (Math.abs(proratedBudget) > 100) {
          const pct = (ni.actual - proratedBudget) / Math.abs(proratedBudget);
          if (pct >= -0.10) healthStatuses[loc] = "green";
          else if (pct >= -0.25) healthStatuses[loc] = "yellow";
          else healthStatuses[loc] = "red";
          statusSet = true;
        }
      }
    }
    // No green/yellow/red could be computed but the location is reporting
    // data (e.g. Uptown pre-opening, no NI budget entered yet) — show a
    // neutral gray dot instead of no dot at all, so its absence doesn't
    // read as a UI bug (flagged by Christine 2026-08-23).
    if (!statusSet && d) {
      healthStatuses[loc] = "gray";
    }
  }

  // Date.now() is impure, so it's read via useSyncExternalStore rather than
  // directly in the render body — server snapshot is null (SSR has no
  // reliable "now"), client snapshot computes the real elapsed days.
  // useSyncExternalStore's getSnapshot is the React-sanctioned place to read
  // impure/external state (wall-clock time); the linter doesn't special-case
  // this hook, so the impure call is suppressed on the line itself below.
  const daysStale = useSyncExternalStore(
    () => () => {},
    // eslint-disable-next-line react-hooks/purity
    () => (uploadedAt ? Math.floor((Date.now() - new Date(uploadedAt).getTime()) / 86400000) : null),
    () => null
  );
  const isStale = daysStale !== null && daysStale > 14;

  // Occupancy has no manual-upload fallback anymore (the Kube API pull
  // replaced it 2026-08) — this is the safety net in its place: if today's
  // calendar-month occupancy row hasn't landed or is over 48h old, the
  // daily automation likely broke silently and needs a look.
  const occupancyUploadedAt = locData.occupancyUploadedAt;
  const occHoursStale = useSyncExternalStore(
    () => () => {},

    () => (occupancyUploadedAt ? Math.floor((Date.now() - new Date(occupancyUploadedAt).getTime()) / 3600000) : null),
    () => null
  );
  // Missing row is a pure prop check (safe pre-hydration, no flash); "too
  // old" needs the impure clock read above, so it only applies once
  // hydrated — same asymmetry as the financial isStale check above.
  const isOccupancyMissing = !occupancyUploadedAt;
  const isOccupancyStale = isOccupancyMissing || (occHoursStale !== null && occHoursStale > 48);

  const activeMonth = selectedMonth ?? locData.availableMonths[0];

  const reconNotes = currentData?.reconciliation_notes ?? [];

  // Live refresh: an open (unlocked) period is still being pushed to
  // through the day by the GL/occupancy pipelines, so the Overview
  // shouldn't need a manual reload to reflect that. router.refresh()
  // re-runs the server component (a fresh Supabase read, no client cache),
  // scoped to whichever period is currently on screen — a locked/closed
  // period is final by definition and gets no polling. Cleared on
  // unmount and whenever the locked period changes so switching to a
  // locked month stops the interval instead of refreshing dead data.
  useEffect(() => {
    if (current?.locked) return;
    const id = setInterval(() => router.refresh(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [current?.locked, current?.month, activeLocation, router]);

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const totalGlIssues = LOCATIONS.reduce((sum, loc) => {
    const d = locationData[loc].current?.data;
    const reviewKey = locationData[loc].current ? `${loc}|${locationData[loc].current!.month}` : "";
    const reviewed = reviewOverrides[reviewKey] ?? locationData[loc].current?.gl_reviewed ?? false;
    // Locked periods don't need review -- see flagCounts above for the same rule.
    if (reviewed || locationData[loc].current?.locked) return sum;
    return sum + (d?.variance_flags?.length ?? 0) + (d?.control_violations?.length ?? 0) + (d?.journal_entry_accounts?.length ?? 0);
  }, 0);

  return (
    <DashboardShell active={activeTab} onChange={setActiveTab} flagCounts={flagCounts} healthStatuses={healthStatuses}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5">
        <div className="flex items-center justify-end gap-2.5 sm:gap-4 flex-wrap">
          {/* Ops/data-health status — one small corner indicator instead of
              full-width banners competing with the business content. */}
          {role === "admin" && (() => {
            const dotColor = isStale ? "bg-amber-400" : totalGlIssues > 0 ? "bg-amber-400" : "bg-emerald-400";
            const label = isStale
              ? `Data ${daysStale}d stale`
              : totalGlIssues > 0
              ? `${totalGlIssues} GL issue${totalGlIssues !== 1 ? "s" : ""} to review across portfolio`
              : "Data current";
            return (
              <div
                title={label}
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 text-[11px] text-gray-500 cursor-default"
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                {label}
              </div>
            );
          })()}

          <DataDictionary />

          <span className="text-xs text-gray-400 hidden md:block">{userEmail}</span>
          {role === "admin" && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#fdf2e9] text-[#F15B27]">
              Admin
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors duration-150 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5 flex-1">

        {/* Consolidated view — all 5 locations, one shared period selector */}
        {isConsolidated ? (() => {
          const portfolio = computePortfolioSnapshot(locationData, consolidatedMonth);
          const portfolioTrend = computePortfolioTrend(locationData);
          const onPace = LOCATIONS.filter(l => healthStatuses[l] === "green").length;
          const atRisk = LOCATIONS.filter(l => healthStatuses[l] === "yellow").map(l => l);
          const offTrack = LOCATIONS.filter(l => healthStatuses[l] === "red").map(l => l);
          const scored = LOCATIONS.filter(l => healthStatuses[l] !== undefined).length;
          const portfolioOcc = computePortfolioOccupancy(locationData, consolidatedMonth);
          const portfolioOccDelta = occupancyDeltaLabel(portfolioOcc.avg ?? undefined, portfolioOcc.priorAvg ?? undefined);
          const headline = scored === 0
            ? "Upload financial data to see portfolio performance."
            : offTrack.length > 0
            ? `${onPace} of ${scored} locations on pace — ${offTrack.join(", ")} off track${atRisk.length ? `, ${atRisk.join(", ")} at risk` : ""}.`
            : atRisk.length > 0
            ? `${onPace} of ${scored} locations on pace — ${atRisk.join(", ")} at risk.`
            : `All ${scored} locations on pace vs budget.`;

          const paceMethodNote = scored > 0
            ? "Based on Net Income vs. prorated budget-to-date, per location: on pace = within 10% of budget · at risk = 10–25% behind · off track = more than 25% behind. Matches the health dot on each location's tab."
            : undefined;

          return (
            <div className="space-y-5">
              <InsightPanel insight={headline} detail={`Portfolio · ${consolidatedDisplayMonth}`} methodNote={paceMethodNote} />

              {/* Hero pair: Net Income + Occupancy, boxed and filling the full row width */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <HeroCard
                  label={`Net Income · ${consolidatedDisplayMonth}`}
                  value={fmtExec(portfolio.ni)}
                  valueNegative={portfolio.ni < 0}
                />
                <HeroCard
                  label={`Occupancy · ${consolidatedDisplayMonth}`}
                  value={portfolioOcc.avg != null ? `${Math.round(portfolioOcc.avg)}%` : "—"}
                  sub={
                    portfolioOcc.avg == null
                      ? "No occupancy data yet"
                      : `${portfolioOcc.count} of ${LOCATIONS.length} locations reporting${portfolioOccDelta ? ` · ${portfolioOccDelta}` : ""}`
                  }
                />
              </div>

              {/* Occupancy: three stacked tables, Total Space highlighted with
                  a glow ring on top, then the blended portfolio trend chart
                  right after (2026-08-25, Max's final layout call). */}
              <div className="space-y-4">
                <OccupancyHistoryTable
                  title="Total Space Occupancy — 2026"
                  subtitle="Month over month across all 5 locations"
                  rows={computeOccupancyHistoryRows(locationData, "total")}
                  highlight="glow-ring"
                />
                <OccupancyHistoryTable
                  title="Private Office Occupancy — 2026"
                  subtitle="Month over month across all 5 locations"
                  rows={computeOccupancyHistoryRows(locationData, "private_office")}
                />
                <OccupancyHistoryTable
                  title="Dedicated Desk Occupancy — 2026"
                  subtitle="Month over month across all 5 locations"
                  rows={computeOccupancyHistoryRows(locationData, "dedicated_desk")}
                />
              </div>

              {(() => {
                const portfolioOccTrend = computePortfolioOccupancyTrend(locationData);
                return portfolioOccTrend.filter(p => p.occupancy_pct != null).length >= 2 ? (
                  <div className="bg-white rounded-lg border border-gray-200">
                    <OccupancyTrendChart history={portfolioOccTrend} title="Portfolio Occupancy — 2026" />
                  </div>
                ) : null;
              })()}

              {/* Drill-down grid — the second click, not the first thing seen */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">By location</p>
                  <PeriodPills
                    months={consolidatedMonths}
                    active={consolidatedMonth}
                    onSelect={setConsolidatedMonth}
                    extraFirstPill={{ label: "Latest", selected: consolidatedMonth === null, onClick: () => setConsolidatedMonth(null) }}
                  />
                </div>
                <LocationSummaryTable
                  locationData={Object.fromEntries(
                    LOCATIONS.map(loc => [loc, {
                      current: locationData[loc].current,
                      allRecords: locationData[loc].allRecords,
                    }])
                  ) as Record<Location, { current: MonthlyRecord | null; allRecords: MonthlyRecord[] }>}
                  selectedMonth={consolidatedMonth}
                />
              </div>

              {portfolioTrend.length > 0 && (
                <TrendChart data={portfolioTrend} />
              )}
            </div>
          );
        })() : (
        <>

        {/* Month selector — January on the left through December on the right, grouped by year */}
        <PeriodPills
          months={locData.availableMonths}
          active={activeMonth}
          onSelect={handleMonthSelect}
        />

        {/* Sub-tabs: Overview | GL Check | Financial Packet | Occupancy —
            teal underline + teal text for the active tab, gray for inactive. */}
        <div className="flex items-center gap-1 border-b border-gray-200 pb-0">
          {(["overview", "gl", "packet", "occupancy"] as const).map((view) => {
            const labels: Record<typeof view, string> = {
              overview: "Overview",
              gl: "GL Check",
              packet: "Financial Packet",
              occupancy: "Occupancy",
            };
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={[
                  "px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer border-b-2 -mb-px",
                  active
                    ? "border-[#1F3642] text-[#1F3642]"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300",
                ].join(" ")}
              >
                {labels[view]}
                {view === "gl" && (() => {
                  const glIssues = (currentData?.variance_flags?.length ?? 0) + (currentData?.control_violations?.length ?? 0) + (currentData?.journal_entry_accounts?.length ?? 0);
                  const reviewKey = current ? `${activeLocation}|${current.month}` : "";
                  const isReviewed = reviewOverrides[reviewKey] ?? current?.gl_reviewed ?? false;
                  // Same 3-tier severity as GLCheckTab's own status pill and
                  // the sidebar badge. Locked periods don't need review.
                  return glIssues > 0 && !isReviewed && !current?.locked && (
                    <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                      glIssues <= 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                    }`}>
                      {glIssues}
                    </span>
                  );
                })()}
              </button>
            );
          })}
        </div>

        {/* Period banner — only when there's a real period to show. With zero
            records (e.g. a location before its first upload), currentMonth
            falls back to "—" and priorMonth to "Prior", which rendered a
            confusing half-populated banner directly above the "No data"
            empty state below. */}
        {current && (
          <PeriodBanner
            currentMonth={currentMonth}
            priorMonth={priorMonth}
            uploadedAt={current?.uploaded_at}
            locked={prior?.locked}
            currentLocked={current?.locked}
            role={role}
            location={activeLocation}
          />
        )}

        {/* GL Check view */}
        {activeView === "gl" && (
          currentData && current ? (
            <GLCheckTab
              currentData={currentData}
              priorMonth={priorMonth}
              uploadedAt={current?.uploaded_at}
              locked={current?.locked}
              reviewed={reviewOverrides[`${activeLocation}|${current.month}`] ?? current.gl_reviewed}
              reviewedBy={current.gl_reviewed_by}
              reviewedAt={current.gl_reviewed_at}
              onReviewChange={(reviewed) =>
                setReviewOverrides(prev => ({ ...prev, [`${activeLocation}|${current.month}`]: reviewed }))
              }
              itemReviews={glItemReviews.filter(r => r.location === activeLocation && r.month === current.month)}
              itemNotes={glItemNotes.filter(n => n.location === activeLocation && n.month === current.month)}
            />
          ) : (
            <NoLocationData location={activeLocation} detail="GL data for this location hasn't been uploaded yet." />
          )
        )}

        {/* Financial Packet view */}
        {activeView === "packet" && (
          currentData ? (
            <FinancialPacketTab
              currentData={currentData}
              packet={packetData[activeLocation]?.find(p => p.month === currentData.month) ?? null}
            />
          ) : (
            <NoLocationData location={activeLocation} detail="Financial data for this location hasn't been uploaded yet." />
          )
        )}

        {/* Occupancy view */}
        {activeView === "occupancy" && (
          <>
            {isOccupancyStale && (
              <AlertBanner
                className="mb-4"
                message={
                  isOccupancyMissing
                    ? "No occupancy data yet for the current month — the daily Kube pull may not have run."
                    : `Occupancy last updated ${occHoursStale}h ago — the daily Kube pull may have stopped running.`
                }
              />
            )}
            <OccupancySection
              current={occupancy}
              prior={priorOccupancy}
              expectedMonth={currentMonth !== "—" ? currentMonth : undefined}
              history={currentMonth !== "—" ? buildOccupancyHistory(locData.allOccupancy, currentMonth) : undefined}
            />
          </>
        )}

        {/* Overview view — packet-style layout (2026-08-25 Round 2, matching
            the layout Christine flagged from her own Frisco "Dashboard"
            tab): brand title band + KPI strip + chart trio, then five
            numbered accounting sections. Replaces the prior hero/KPI-row/
            P&L-table layout entirely rather than stacking both. */}
        {activeView === "overview" && currentData ? (() => {
          const heroInsight = currentData.insights?.[0];
          const heroDetail = currentData.insights?.[1];
          const occupancyTrend = locData.allOccupancy.map(o => ({ month: o.month, occupancy_pct: o.data?.occupancy_pct ?? null }));
          return (
            <div className="space-y-5">
              <InsightPanel
                insight={heroInsight ?? `Net Income for ${currentMonth}`}
                detail={heroDetail}
                actionLabel="View GL Check"
                onAction={() => setActiveView("gl")}
              />

              {/* Stale-data + reconciliation-flag warnings — both can be
                  active at once on Overview; capped to showing the single
                  highest-priority one inline with a "+N more" affordance
                  instead of stacking every active banner. Stale data ranks
                  first (data currency is the more fundamental trust signal). */}
              {(() => {
                const items: AlertBannerItem[] = [];
                if (isStale) {
                  items.push({ key: "stale", message: `Data last updated ${daysStale} days ago — verify this reflects the current close period.` });
                }
                if (reconNotes.length > 0) {
                  items.push({ key: "recon", title: "Reconciliation Flag", message: reconNotes.join(" ") });
                }
                return <AlertBannerStack items={items} />;
              })()}

              <OverviewPacket
                location={activeLocation}
                currentData={currentData}
                priorData={priorData}
                occupancy={occupancy}
                priorOccupancy={priorOccupancy}
                trend={periodTrend}
                occupancyTrend={occupancyTrend}
                packet={packetData[activeLocation]?.find(p => p.month === currentData.month) ?? null}
                locked={current?.locked ?? false}
                uploadedAt={current?.uploaded_at}
                pacingPct={isFullMonth ? null : pacingPct}
              />
            </div>
          );
        })() : activeView === "overview" ? (
          <NoLocationData location={activeLocation} detail="Financial data for this location hasn't been uploaded yet." />
        ) : null}
        </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <p className="text-xs text-gray-300">25N Coworking · Financial Dashboard</p>
        </div>
      </footer>
    </DashboardShell>
  );
}
