"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { LOCATIONS, Location } from "@/types/dashboard";
import type { MonthlyRecord, TrendPoint, FinancialData, OccupancyData, MonthlyPacket } from "@/types/dashboard";
import { LocationTabs, LocationTab } from "@/components/dashboard/LocationTabs";
import { PeriodBanner } from "@/components/dashboard/PeriodBanner";
import { IncomeKpiRow } from "@/components/dashboard/IncomeKpiRow";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { PlTable } from "@/components/dashboard/PlTable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { OccupancySection } from "@/components/dashboard/OccupancySection";
import { VariancePanel } from "@/components/dashboard/VariancePanel";
import { LocationSummaryTable } from "@/components/dashboard/LocationSummaryTable";
import { SummaryBanner } from "@/components/dashboard/SummaryBanner";
import { DataDictionary } from "@/components/dashboard/DataDictionary";
import { GLCheckTab } from "@/components/dashboard/GLCheckTab";
import { FinancialPacketTab } from "@/components/dashboard/FinancialPacketTab";

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
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const uploadDate = new Date(uploadedAt);
  if (uploadDate.getFullYear() === year && uploadDate.getMonth() === monthIdx) {
    return uploadDate.getDate() / daysInMonth;
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

export function DashboardClient({ locationData, packetData, userEmail, role }: Props) {
  const [activeTab, setActiveTab] = useState<LocationTab>(LOCATIONS[0]);
  const isConsolidated = activeTab === "Consolidated";
  const activeLocation: Location = isConsolidated ? LOCATIONS[0] : activeTab;
  const [selectedMonths, setSelectedMonths] = useState<Partial<Record<Location, string>>>({});
  // Consolidated-only period selector — comparing the same period across all 5
  // locations only makes sense there, so this is scoped separately from the
  // per-location month pills (which stay independent per tab).
  const [consolidatedMonth, setConsolidatedMonth] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"overview" | "packet" | "gl" | "occupancy">("overview");
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
    occupancy = locData.occupancy;
    priorOccupancy = locData.priorOccupancy;
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

  // Health badges — prorated NOI vs budget per location
  const flagCounts: Partial<Record<Location, number>> = {};
  const healthStatuses: Partial<Record<Location, HealthStatus>> = {};

  for (const loc of LOCATIONS) {
    const d = locationData[loc].current?.data;
    if (d?.variance_flags && d.variance_flags.length > 0) {
      flagCounts[loc] = d.variance_flags.length;
    }
    const noi = d?.income_statement?.net_operating_income;
    const c = locationData[loc].current;
    if (noi && noi.budget !== undefined && noi.budget !== 0 && c?.uploaded_at && c?.month) {
      const locPacing = computeLocPacingPct(c.month, c.uploaded_at);
      if (locPacing !== null) {
        const proratedBudget = noi.budget * locPacing;
        if (Math.abs(proratedBudget) > 100) {
          const pct = (noi.actual - proratedBudget) / Math.abs(proratedBudget);
          if (pct >= -0.10) healthStatuses[loc] = "green";
          else if (pct >= -0.25) healthStatuses[loc] = "yellow";
          else healthStatuses[loc] = "red";
        }
      }
    }
  }

  const daysStale = uploadedAt
    ? Math.floor((Date.now() - new Date(uploadedAt).getTime()) / 86400000)
    : null;
  const isStale = daysStale !== null && daysStale > 14;

  const activeMonth = selectedMonth ?? locData.availableMonths[0];

  const reconNotes = currentData?.reconciliation_notes ?? [];

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-[#E07A3E]">25N</span>
            <span className="text-gray-300 font-light">·</span>
            <span className="text-sm font-medium text-gray-500">Coworking</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 hidden md:block">{userEmail}</span>
            {role === "admin" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#fdf2e9] text-[#E07A3E]">
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
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5 flex-1">

        {/* Location tabs with health legend */}
        <LocationTabs
          active={activeTab}
          onChange={setActiveTab}
          flagCounts={flagCounts}
          healthStatuses={healthStatuses}
        />

        {/* Consolidated view — all 5 locations, one shared period selector */}
        {isConsolidated ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">All Locations</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {consolidatedMonth ? `${consolidatedMonth} — same period across all locations` : "Most recent closed period per location"}
                </p>
              </div>
              {consolidatedMonths.length > 1 && (() => {
                const MONTH_IDX = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                const parseM = (m: string) => { const [mon, yr] = m.split(" "); return parseInt(yr) * 12 + MONTH_IDX.indexOf(mon); };
                const sorted = [...consolidatedMonths].sort((a, b) => parseM(b) - parseM(a));
                return (
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-nowrap">
                    <button
                      onClick={() => setConsolidatedMonth(null)}
                      className={[
                        "px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150 cursor-pointer flex-shrink-0",
                        consolidatedMonth === null ? "bg-[#E07A3E] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      Latest
                    </button>
                    {sorted.map((month) => (
                      <button
                        key={month}
                        onClick={() => setConsolidatedMonth(month)}
                        className={[
                          "px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150 cursor-pointer flex-shrink-0",
                          consolidatedMonth === month ? "bg-[#E07A3E] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                        ].join(" ")}
                      >
                        {month}
                      </button>
                    ))}
                  </div>
                );
              })()}
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
        ) : (
        <>

        {/* Month selector — sorted newest → oldest */}
        {locData.availableMonths.length > 1 && (() => {
          const MONTH_IDX = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const parseM = (m: string) => { const [mon, yr] = m.split(" "); return parseInt(yr) * 12 + MONTH_IDX.indexOf(mon); };
          const sortedMonths = [...locData.availableMonths].sort((a, b) => parseM(b) - parseM(a));
          return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide flex-shrink-0">Period</span>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-nowrap pb-0.5">
              {sortedMonths.map((month) => (
                <button
                  key={month}
                  onClick={() => handleMonthSelect(month)}
                  className={[
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150 cursor-pointer flex-shrink-0",
                    activeMonth === month
                      ? "bg-[#E07A3E] text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
          );
        })()}

        {/* View tabs: Overview | Financial Packet | GL Check | Occupancy */}
        <div className="flex items-center gap-1 border-b border-gray-200 pb-0">
          {(["overview", "packet", "gl", "occupancy"] as const).map((view) => {
            const labels: Record<typeof view, string> = {
              overview: "Overview",
              packet: "Financial Packet",
              gl: "GL Check",
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
                    ? "border-[#E07A3E] text-[#E07A3E]"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300",
                ].join(" ")}
              >
                {labels[view]}
                {view === "gl" && (currentData?.variance_flags?.length ?? 0) > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                    {currentData!.variance_flags!.length}
                  </span>
                )}
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

        {/* Period banner */}
        <PeriodBanner
          currentMonth={currentMonth}
          priorMonth={priorMonth}
          uploadedAt={current?.uploaded_at}
          locked={prior?.locked}
          role={role}
          location={activeLocation}
        />

        {/* GL Check view */}
        {activeView === "gl" && (
          currentData ? (
            <GLCheckTab currentData={currentData} priorMonth={priorMonth} uploadedAt={current?.uploaded_at} />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No data for {activeLocation} — upload GL data first.</p>
            </div>
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
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No data for {activeLocation} — upload GL data first.</p>
            </div>
          )
        )}

        {/* Occupancy view */}
        {activeView === "occupancy" && (
          <OccupancySection current={occupancy} prior={priorOccupancy} />
        )}

        {/* Overview view */}
        {activeView === "overview" && currentData ? (
          <>
            {/* One-sentence business health summary */}
            <SummaryBanner
              healthStatuses={healthStatuses}
              currentMonth={currentMonth}
              pacingPct={pacingPct}
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

            {/* KPI row — prorated vs budget */}
            <IncomeKpiRow
              current={currentData}
              prior={priorData}
              runRateFactor={runRateFactor}
              pacingPct={isFullMonth ? null : pacingPct}
            />

            {/* Insights — surfaced early, human-language summary */}
            {(currentData.insights?.length ?? 0) > 0 && (
              <InsightsPanel insights={currentData.insights ?? []} />
            )}

            {/* P&L table */}
            <PlTable current={currentData} prior={priorData} pacingPct={isFullMonth ? null : pacingPct} />

            {/* Variance analysis — section-level flags only; account-level detail lives on GL Check */}
            <VariancePanel
              current={currentData}
              prior={priorData}
              glFlags={[]}
              priorMonth={priorMonth}
              pacingPct={isFullMonth ? null : pacingPct}
            />

            {/* Period-aware trend chart */}
            <TrendChart data={periodTrend} />
          </>
        ) : activeView === "overview" ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">No data for {activeLocation}</p>
            <p className="text-xs text-gray-400 mt-1">
              Financial data for this location hasn&apos;t been uploaded yet.
            </p>
          </div>
        ) : null}
        </>
        )}
      </main>

      {/* Footer — data dictionary link */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-300">25N Coworking · Financial Dashboard</p>
          <DataDictionary />
        </div>
      </footer>
    </div>
  );
}
