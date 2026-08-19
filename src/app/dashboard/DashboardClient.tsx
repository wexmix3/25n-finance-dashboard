"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { LOCATIONS, Location } from "@/types/dashboard";
import type { MonthlyRecord, TrendPoint, FinancialData, OccupancyData, MonthlyPacket } from "@/types/dashboard";
import { DashboardShell, LocationTab } from "@/components/dashboard/DashboardShell";
import { PeriodPills } from "@/components/dashboard/PeriodPills";
import { PeriodBanner } from "@/components/dashboard/PeriodBanner";
import { IncomeKpiRow } from "@/components/dashboard/IncomeKpiRow";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { PlTable } from "@/components/dashboard/PlTable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { OccupancySection } from "@/components/dashboard/OccupancySection";
import { VariancePanel } from "@/components/dashboard/VariancePanel";
import { LocationSummaryTable } from "@/components/dashboard/LocationSummaryTable";
import { DataDictionary } from "@/components/dashboard/DataDictionary";
import { GLCheckTab } from "@/components/dashboard/GLCheckTab";
import { FinancialPacketTab } from "@/components/dashboard/FinancialPacketTab";
import { formatCurrency } from "@/lib/formatCurrency";

type HealthStatus = "green" | "yellow" | "red";

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
  packetData: Record<Location, MonthlyPacket | null>;
  userEmail: string;
  role: string;
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

function buildPeriodTrend(allRecords: MonthlyRecord[], endMonth: string): TrendPoint[] {
  const endIdx = allRecords.findIndex(r => r.month === endMonth);
  const slice = endIdx >= 0 ? allRecords.slice(endIdx, endIdx + 12) : allRecords.slice(0, 12);
  return [...slice].reverse().map(r => ({
    month: r.month,
    revenue: r.data?.income_statement?.revenue?._total?.actual ?? 0,
    gp: r.data?.income_statement?.gross_profit?.actual ?? 0,
    noi: r.data?.income_statement?.net_operating_income?.actual ?? 0,
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
function computePortfolioSnapshot(locationData: Record<Location, LocationData>) {
  let revenue = 0, ni = 0, niBudget = 0, revenueBudget = 0, locationsWithData = 0;
  for (const loc of LOCATIONS) {
    const d = locationData[loc].current?.data;
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
  const byMonth = new Map<string, { revenue: number; gp: number; noi: number }>();
  for (const loc of LOCATIONS) {
    for (const r of locationData[loc].allRecords) {
      const cur = byMonth.get(r.month) ?? { revenue: 0, gp: 0, noi: 0 };
      cur.revenue += r.data?.income_statement?.revenue?._total?.actual ?? 0;
      cur.gp += r.data?.income_statement?.gross_profit?.actual ?? 0;
      cur.noi += r.data?.income_statement?.net_operating_income?.actual ?? 0;
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

export function DashboardClient({ locationData, packetData, userEmail, role }: Props) {
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
  const runRateFactor = !isFullMonth && pacingPct && pacingPct > 0 ? 1 / pacingPct : null;

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
    if (totalIssues > 0 && !isReviewed) {
      flagCounts[loc] = totalIssues;
    }
    const ni = d?.income_statement?.net_income;
    const c = locationData[loc].current;
    if (ni && ni.budget !== undefined && ni.budget !== 0 && c?.uploaded_at && c?.month) {
      const locPacing = computeLocPacingPct(c.month, c.uploaded_at);
      if (locPacing !== null) {
        const proratedBudget = ni.budget * locPacing;
        if (Math.abs(proratedBudget) > 100) {
          const pct = (ni.actual - proratedBudget) / Math.abs(proratedBudget);
          if (pct >= -0.10) healthStatuses[loc] = "green";
          else if (pct >= -0.25) healthStatuses[loc] = "yellow";
          else healthStatuses[loc] = "red";
        }
      }
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

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const totalGlIssues = LOCATIONS.reduce((sum, loc) => {
    const d = locationData[loc].current?.data;
    const reviewKey = locationData[loc].current ? `${loc}|${locationData[loc].current!.month}` : "";
    const reviewed = reviewOverrides[reviewKey] ?? locationData[loc].current?.gl_reviewed ?? false;
    if (reviewed) return sum;
    return sum + (d?.variance_flags?.length ?? 0) + (d?.control_violations?.length ?? 0) + (d?.journal_entry_accounts?.length ?? 0);
  }, 0);

  return (
    <DashboardShell active={activeTab} onChange={setActiveTab} flagCounts={flagCounts} healthStatuses={healthStatuses}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3.5">
        <div className="flex items-center justify-end gap-4">
          {/* Ops/data-health status — one small corner indicator instead of
              full-width banners competing with the business content. */}
          {role === "admin" && (() => {
            const dotColor = isStale ? "bg-amber-400" : totalGlIssues > 0 ? "bg-amber-400" : "bg-emerald-400";
            const label = isStale
              ? `Data ${daysStale}d stale`
              : totalGlIssues > 0
              ? `${totalGlIssues} GL issue${totalGlIssues !== 1 ? "s" : ""} to review`
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
          const portfolio = computePortfolioSnapshot(locationData);
          const portfolioTrend = computePortfolioTrend(locationData);
          const niVsBudget = portfolio.ni - portfolio.niBudget;
          const onPace = LOCATIONS.filter(l => healthStatuses[l] === "green").length;
          const atRisk = LOCATIONS.filter(l => healthStatuses[l] === "yellow").map(l => l);
          const offTrack = LOCATIONS.filter(l => healthStatuses[l] === "red").map(l => l);
          const scored = LOCATIONS.filter(l => healthStatuses[l] !== undefined).length;
          const headline = scored === 0
            ? "Upload financial data to see portfolio performance."
            : offTrack.length > 0
            ? `${onPace} of ${scored} locations on pace — ${offTrack.join(", ")} off track${atRisk.length ? `, ${atRisk.join(", ")} at risk` : ""}.`
            : atRisk.length > 0
            ? `${onPace} of ${scored} locations on pace — ${atRisk.join(", ")} at risk.`
            : `All ${scored} locations on pace vs budget.`;

          return (
            <div className="space-y-5">
              <InsightPanel insight={headline} detail={`Portfolio · ${currentMonth}`} />

              {/* Hero: portfolio number, no card chrome */}
              <div className="pt-1 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Net Income · {currentMonth}</p>
                <p className={`text-6xl font-bold tracking-tight tabular-nums ${portfolio.ni < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {fmtExec(portfolio.ni)}
                </p>
              </div>

              {/* Secondary stats — plain inline row, no individual cards */}
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-3 border-y border-gray-200">
                <div><span className="text-xs text-gray-400">Revenue: </span><span className="text-sm font-semibold text-gray-800 tabular-nums">{fmtExec(portfolio.revenue)}</span></div>
                <div><span className="text-xs text-gray-400">Net Income vs Budget: </span><span className={`text-sm font-semibold tabular-nums ${niVsBudget >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(niVsBudget, { compact: true, showSign: true })}</span></div>
                <div><span className="text-xs text-gray-400">Locations reporting: </span><span className="text-sm font-semibold text-gray-800 tabular-nums">{portfolio.locationsWithData} of {LOCATIONS.length}</span></div>
              </div>

              {portfolioTrend.length > 0 && (
                <TrendChart data={portfolioTrend} />
              )}

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
                  // the sidebar badge.
                  return glIssues > 0 && !isReviewed && (
                    <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                      glIssues <= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    }`}>
                      {glIssues}
                    </span>
                  );
                })()}
              </button>
            );
          })}
        </div>

        {/* Stale data warning */}
        {isStale && activeView === "overview" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2.5">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-xs text-amber-800 font-medium">
              Data last updated {daysStale} days ago — verify this reflects the current close period.
            </span>
          </div>
        )}

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
              reviewed={reviewOverrides[`${activeLocation}|${current.month}`] ?? current.gl_reviewed}
              reviewedBy={current.gl_reviewed_by}
              reviewedAt={current.gl_reviewed_at}
              onReviewChange={(reviewed) =>
                setReviewOverrides(prev => ({ ...prev, [`${activeLocation}|${current.month}`]: reviewed }))
              }
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
              packet={packetData[activeLocation] ?? null}
            />
          ) : (
            <NoLocationData location={activeLocation} detail="Financial data for this location hasn't been uploaded yet." />
          )
        )}

        {/* Occupancy view */}
        {activeView === "occupancy" && (
          <>
            {isOccupancyStale && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2.5 mb-4">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span className="text-xs text-amber-800 font-medium">
                  {isOccupancyMissing
                    ? "No occupancy data yet for the current month — the daily Kube pull may not have run."
                    : `Occupancy last updated ${occHoursStale}h ago — the daily Kube pull may have stopped running.`}
                </span>
              </div>
            )}
            <OccupancySection current={occupancy} prior={priorOccupancy} expectedMonth={currentMonth !== "—" ? currentMonth : undefined} />
          </>
        )}

        {/* Overview view — headline-first design (2026-08-18 Round 1), now
            the only Overview, no Executive/Finance mode switch. */}
        {activeView === "overview" && currentData ? (() => {
          const is = currentData.income_statement;
          const ni = is.net_income.actual;
          const niMargin = is.net_income.margin_pct;
          const niVsBudget = ni - is.net_income.budget;
          const heroInsight = currentData.insights?.[0];
          const heroDetail = currentData.insights?.[1];
          return (
            <>
              <InsightPanel
                insight={heroInsight ?? `Net Income for ${currentMonth}`}
                detail={heroDetail}
                actionLabel="View GL Check →"
                onAction={() => setActiveView("gl")}
              />

              {/* Recon flag — surfaced as a banner, not buried in KPI grid */}
              {reconNotes.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Reconciliation Flag</p>
                    {reconNotes.map((note, i) => (
                      <p key={i} className="text-xs text-amber-700">{note}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Hero: the number IS the deliverable */}
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Net Income · {currentMonth}</p>
                <p className={`font-bold tracking-tight tabular-nums mt-1 text-6xl ${ni < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {fmtExec(ni)}
                </p>
                <p className="text-sm text-gray-500 mt-1.5">
                  {niMargin.toFixed(1)}% margin · {formatCurrency(niVsBudget, { compact: true, showSign: true })} vs budget
                </p>
              </div>

              {/* Secondary stats: plain inline row, no individual card borders */}
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-3 border-y border-gray-200">
                {[
                  { label: "Revenue", value: fmtExec(is.revenue._total.actual) },
                  { label: "Gross Profit", value: fmtExec(is.gross_profit.actual) },
                  { label: "OPEX", value: fmtExec(is.opex._total.actual) },
                  { label: "NOI", value: fmtExec(is.net_operating_income.actual) },
                ].map((s) => (
                  <div key={s.label}>
                    <span className="text-xs text-gray-400">{s.label}: </span>
                    <span className="text-sm font-semibold text-gray-800 tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>

              {/* KPI row — prorated vs budget */}
              <IncomeKpiRow
                current={currentData}
                prior={priorData}
                runRateFactor={runRateFactor}
                pacingPct={isFullMonth ? null : pacingPct}
              />

              <TrendChart data={periodTrend} />

              {/* Full income statement — collapsed line items by default,
                  "Show full breakdown" (inside PlTable) reveals detail. */}
              <PlTable current={currentData} prior={priorData} pacingPct={isFullMonth ? null : pacingPct} />

              {/* Variance analysis — section-level flags only; account-level detail lives on GL Check */}
              <VariancePanel
                current={currentData}
                prior={priorData}
                glFlags={[]}
                priorMonth={priorMonth}
                pacingPct={isFullMonth ? null : pacingPct}
              />
            </>
          );
        })() : activeView === "overview" ? (
          <NoLocationData location={activeLocation} detail="Financial data for this location hasn't been uploaded yet." />
        ) : null}
        </>
        )}
      </main>

      {/* Footer — data dictionary link */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-300">25N Coworking · Financial Dashboard</p>
          <DataDictionary />
        </div>
      </footer>
    </DashboardShell>
  );
}
