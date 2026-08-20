"use client";

import type { OccupancyData } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

function deltaInt(curr: number | undefined, prev: number | undefined): string | null {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  return `${d > 0 ? "+" : ""}${d}`;
}

function fmt$(n: number | undefined): string {
  if (n === undefined) return "—";
  return formatCurrency(n, { zeroDash: false });
}

function OccupancyTrendChart({ history }: { history: { month: string; occupancy_pct: number | null }[] }) {
  const chartData = history.filter(h => h.occupancy_pct != null);
  if (chartData.length < 2) return null;
  const lastIndex = chartData.length - 1;

  return (
    <div className="px-4 pb-4 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">6-Month Occupancy Trend</p>
      <ResponsiveContainer width="100%" height={160} debounce={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fillOccupancy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F15B27" stopOpacity={0.08} />
              <stop offset="95%" stopColor="#F15B27" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" />
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
          />
          <Area
            type="monotone"
            dataKey="occupancy_pct"
            stroke="#F15B27"
            strokeWidth={2}
            fill="url(#fillOccupancy)"
            connectNulls
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props;
              if (cx == null || cy == null || index == null) return <g />;
              const isCurrent = index === lastIndex;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isCurrent ? 4.5 : 2.5}
                  fill={isCurrent ? "#F15B27" : "#d1d5db"}
                  stroke={isCurrent ? "#ffffff" : "none"}
                  strokeWidth={isCurrent ? 1.5 : 0}
                />
              );
            }}
            activeDot={{ r: 5 }}
            name="Occupancy"
          />
        </AreaChart>
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
  const memberDelta = deltaInt(current.total_members ?? undefined, prior?.total_members ?? undefined);

  const utilization =
    current.booked_desks != null && current.available_desks != null && current.available_desks > 0
      ? Math.round((current.booked_desks / current.available_desks) * 100)
      : null;
  const priorUtilization =
    prior?.booked_desks != null && prior?.available_desks != null && prior.available_desks > 0
      ? Math.round((prior.booked_desks / prior.available_desks) * 100)
      : null;
  // Utilization previously showed no MoM comparison at all while every
  // sibling stat had one, so its absolute-level red/amber/green coloring
  // read as arbitrary next to Occupancy's neutral black at the same value
  // (Round 3 UX audit, 2026-08-19). Giving it the same delta line the others
  // get makes the color legible as "low and worth watching," not random.
  const utilizationDelta = deltaInt(utilization ?? undefined, priorUtilization ?? undefined);

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

        {/* Avg daily occupied */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Occupied</p>
          <p className="text-2xl font-semibold text-gray-900">
            {current.total_members != null ? current.total_members.toLocaleString() : "—"}
          </p>
          {memberDelta && (
            <p className={`text-xs mt-0.5 ${memberDelta.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
              {memberDelta} MoM
            </p>
          )}
        </div>

        {/* Booked desks */}
        {current.booked_desks != null && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Units Booked</p>
            <p className="text-2xl font-semibold text-gray-900">
              {current.booked_desks.toLocaleString()}
            </p>
            {current.available_desks != null && (
              <p className="text-xs text-gray-400 mt-0.5">of {current.available_desks}</p>
            )}
          </div>
        )}

        {/* Contract revenue */}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Contract Revenue</p>
          <p className="text-2xl font-semibold text-gray-900">
            {fmt$(current.raw.contract_revenue)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">this period</p>
        </div>

        {/* Utilization rate (computed) */}
        {utilization != null && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Utilization</p>
            <p className={`text-2xl font-semibold ${utilization >= 80 ? "text-emerald-600" : utilization >= 60 ? "text-amber-700" : "text-red-600"}`}>
              {utilization}%
            </p>
            {utilizationDelta ? (
              <p className={`text-xs mt-0.5 ${utilizationDelta.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                {utilizationDelta} MoM
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">booked / available</p>
            )}
          </div>
        )}
      </div>

      {/* YTD + space-type breakdown */}
      {(current.raw.ytd_occupancy_pct != null || (current.raw.space_breakdown?.length ?? 0) > 0) && (
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
          {(current.raw.space_breakdown?.length ?? 0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {current.raw.space_breakdown!.map((sb) => (
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
