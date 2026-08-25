"use client";

import type { OccupancyData } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { occupancyMetricValue, occupancyMetricUnits } from "@/lib/occupancy";

interface Props {
  current: OccupancyData | null;
  prior: OccupancyData | null;
  expectedMonth?: string;
  /** Last N months of occupancy, oldest first — fills the large blank area
   * below the single stat card with a trend chart instead of empty space. */
  history?: { month: string; occupancy_pct: number | null }[];
}

/** Whole-number percent delta in accounting language — negatives in
 * parentheses rather than a minus sign, matching the currency convention
 * used everywhere else on the dashboard. Exported for reuse by the
 * Overview hero's Occupancy card, which needs the same formatting. */
export function occupancyDeltaLabel(curr: number | undefined, prev: number | undefined): string | null {
  if (curr == null || prev == null || prev === 0) return null;
  const d = Math.round(curr - prev);
  if (d === 0) return "flat MoM";
  return d > 0 ? `+${d}% MoM` : `(${Math.abs(d)}%) MoM`;
}

function fmt$(n: number | undefined): string {
  if (n === undefined) return "—";
  return formatCurrency(n, { zeroDash: false });
}

/** Exported for reuse by the Consolidated Overview's portfolio-wide
 * occupancy trend (Christine's 2026-08-19 "historical occupancies" ask). */
export function OccupancyTrendChart({ history, title = "6-Month Occupancy Trend" }: { history: { month: string; occupancy_pct: number | null }[]; title?: string }) {
  const chartData = history.filter(h => h.occupancy_pct != null);
  if (chartData.length < 2) return null;
  const lastIndex = chartData.length - 1;

  return (
    <div className="px-4 pb-4 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={160} debounce={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => v.split(" ")[0]}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "Occupancy"]}
            labelStyle={{ fontSize: 11, fontWeight: 600 }}
            contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 8 }}
            cursor={{ fill: "#F15B27", fillOpacity: 0.06 }}
          />
          <Bar dataKey="occupancy_pct" name="Occupancy" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={d.month} fill={i === lastIndex ? "#F15B27" : "#F9C4AB"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OccupancySection({ current, prior, expectedMonth, history }: Props) {
  if (!current) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">
            {expectedMonth ? `No Occupancy Data for ${expectedMonth}` : "Occupancy Data Pending"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {expectedMonth
              ? `The Kube tracker for ${expectedMonth} hasn't been uploaded yet — occupancy runs on its own upload cadence, separate from the financial close.`
              : "Occupancy data will appear here once the first monthly tracker is processed."}
          </p>
        </div>
      </div>
    );
  }

  const occDelta = occupancyDeltaLabel(current.occupancy_pct ?? undefined, prior?.occupancy_pct ?? undefined);

  const privateOfficePct = occupancyMetricValue(current, "private_office");
  const privateOfficeDelta = occupancyDeltaLabel(privateOfficePct ?? undefined, occupancyMetricValue(prior, "private_office") ?? undefined);
  const privateOfficeUnits = occupancyMetricUnits(current, "private_office");

  const dedicatedDeskPct = occupancyMetricValue(current, "dedicated_desk");
  const dedicatedDeskDelta = occupancyDeltaLabel(dedicatedDeskPct ?? undefined, occupancyMetricValue(prior, "dedicated_desk") ?? undefined);
  const dedicatedDeskUnits = occupancyMetricUnits(current, "dedicated_desk");

  // Only the five space types that factor into occupancy_pct (Christine
  // confirmed 2026-08-17, see parse_kube_api_occupancy.py CORE_TYPE_PREFIXES)
  // — Day Office and Meeting Rooms are excluded from the ratio, so showing
  // them here read as a competing number that didn't roll up into the total.
  const CORE_TYPE_PREFIXES = ["Dedicated Desk", "Private Office", "Full Floor Office", "Office Suite", "Team Office"];
  const coreSpaceBreakdown = current.raw.space_breakdown?.filter((sb) =>
    CORE_TYPE_PREFIXES.some((prefix) => sb.space_type.startsWith(prefix))
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Occupancy</h3>
        <p className="text-xs text-gray-400 mt-0.5">{current.month} — from Kube</p>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Occupancy % */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Occupancy</p>
          <p className="text-2xl font-semibold text-gray-900">
            {current.occupancy_pct != null ? `${current.occupancy_pct}%` : "—"}
          </p>
          {occDelta && (
            <p className={`text-xs mt-0.5 ${occDelta.startsWith("(") ? "text-red-600" : occDelta.startsWith("+") ? "text-emerald-600" : "text-gray-400"}`}>
              {occDelta}
            </p>
          )}
        </div>

        {/* Private Offices Occupied */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Private Offices Occupied</p>
          <p className="text-2xl font-semibold text-gray-900">
            {privateOfficePct != null ? `${privateOfficePct}%` : "—"}
          </p>
          {privateOfficeUnits && (
            <p className="text-xs text-gray-400 mt-0.5">{privateOfficeUnits.occupied} of {privateOfficeUnits.total}</p>
          )}
          {privateOfficeDelta && (
            <p className={`text-xs mt-0.5 ${privateOfficeDelta.startsWith("(") ? "text-red-600" : privateOfficeDelta.startsWith("+") ? "text-emerald-600" : "text-gray-400"}`}>
              {privateOfficeDelta}
            </p>
          )}
        </div>

        {/* Dedicated Desks Occupied */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Dedicated Desks Occupied</p>
          <p className="text-2xl font-semibold text-gray-900">
            {dedicatedDeskPct != null ? `${dedicatedDeskPct}%` : "—"}
          </p>
          {dedicatedDeskUnits && (
            <p className="text-xs text-gray-400 mt-0.5">{dedicatedDeskUnits.occupied} of {dedicatedDeskUnits.total}</p>
          )}
          {dedicatedDeskDelta && (
            <p className={`text-xs mt-0.5 ${dedicatedDeskDelta.startsWith("(") ? "text-red-600" : dedicatedDeskDelta.startsWith("+") ? "text-emerald-600" : "text-gray-400"}`}>
              {dedicatedDeskDelta}
            </p>
          )}
        </div>

        {/* Contract revenue */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Contract Revenue</p>
          <p className="text-2xl font-semibold text-gray-900">
            {fmt$(current.raw.contract_revenue)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">this period</p>
        </div>
      </div>

      {/* YTD + space-type breakdown */}
      {(current.raw.ytd_occupancy_pct != null || (coreSpaceBreakdown?.length ?? 0) > 0) && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-6 mb-2 mt-3">
            {current.raw.ytd_occupancy_pct != null && (
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{current.raw.ytd_occupancy_pct}%</span> YTD occupancy
              </p>
            )}
            {current.raw.ytd_revenue != null && (
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{fmt$(current.raw.ytd_revenue)}</span> YTD revenue
              </p>
            )}
          </div>
          {(coreSpaceBreakdown?.length ?? 0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {coreSpaceBreakdown!.map((sb) => (
                <div key={sb.space_type} className="rounded border border-gray-100 bg-gray-50 px-2.5 py-2">
                  <p className="text-[11px] text-gray-500">{sb.space_type}</p>
                  <p className="text-sm font-semibold text-gray-800 tabular-nums">
                    {Math.round(sb.occupancy_rate * 100)}%
                    <span className="text-[11px] font-normal text-gray-400 ml-1">
                      ({Math.round(sb.occupied_units)}/{Math.round(sb.total_units)})
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {history && <OccupancyTrendChart history={history} />}
    </div>
  );
}
