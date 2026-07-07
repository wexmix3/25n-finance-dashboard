"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { LOCATIONS, Location } from "@/types/dashboard";
import type { MonthlyRecord, TrendPoint, FinancialData } from "@/types/dashboard";
import { LocationTabs } from "@/components/dashboard/LocationTabs";
import { PeriodBanner } from "@/components/dashboard/PeriodBanner";
import { IncomeKpiRow } from "@/components/dashboard/IncomeKpiRow";
import { PlTable } from "@/components/dashboard/PlTable";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { OccupancyPlaceholder } from "@/components/dashboard/OccupancyPlaceholder";

interface LocationData {
  current: MonthlyRecord | null;
  prior: MonthlyRecord | null;
  trend: TrendPoint[];
}

interface Props {
  locationData: Record<Location, LocationData>;
  userEmail: string;
  role: string;
}

export function DashboardClient({ locationData, userEmail, role }: Props) {
  const [activeLocation, setActiveLocation] = useState<Location>(LOCATIONS[0]);
  const router = useRouter();

  const { current, prior, trend } = locationData[activeLocation];
  const currentData: FinancialData | null = current?.data ?? null;
  const priorData: FinancialData | null = prior?.data ?? null;

  const currentMonth = currentData?.month ?? "—";
  const priorMonth = priorData?.month ?? getPriorMonthLabel(currentMonth);

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">25N Coworking</h1>
            <p className="text-xs text-gray-400">Financial Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">{userEmail}</span>
            {role === "admin" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                Admin
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* Location tabs */}
        <LocationTabs active={activeLocation} onChange={setActiveLocation} />

        {/* Period banner */}
        <PeriodBanner
          currentMonth={currentMonth}
          priorMonth={priorMonth}
          uploadedAt={current?.uploaded_at}
          locked={prior?.locked}
        />

        {currentData ? (
          <>
            {/* KPI row */}
            <IncomeKpiRow current={currentData} prior={priorData} />

            {/* P&L table */}
            <PlTable current={currentData} prior={priorData} />

            {/* Occupancy */}
            <OccupancyPlaceholder />

            {/* Bottom row: trend + insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <TrendChart data={trend} />
              </div>
              <InsightsPanel insights={currentData.insights ?? []} />
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
            <p className="text-sm font-medium text-gray-500">No data for {activeLocation}</p>
            <p className="text-xs text-gray-400 mt-1">
              Run the push script to upload financial data for this location.
            </p>
            <code className="mt-3 block text-xs text-gray-500 bg-gray-50 rounded p-3 text-left">
              python push_to_dashboard.py --location {activeLocation} --month "Jun 2026"
            </code>
          </div>
        )}
      </main>
    </div>
  );
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
