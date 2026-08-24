"use client";

import { LOCATIONS, Location } from "@/types/dashboard";

interface Props {
  // month -> location -> occupancy_pct (null when that location hasn't
  // reported that month yet). Pre-computed by the caller from the same
  // allOccupancy source the portfolio trend chart already reads, so this
  // table and that chart can never disagree about what "occupancy" means.
  rows: { month: string; byLocation: Partial<Record<Location, number | null>> }[];
}

// Matches LocationSummaryTable's fixed-width convention so a wide value in
// one column doesn't visually shove its neighbors around.
const DATA_COL_WIDTH = "w-24";

function fmtPct(v: number | null | undefined): string {
  return v != null ? `${Math.round(v)}%` : "—";
}

export function OccupancyHistoryTable({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">Occupancy by Location — 2026</h3>
        <p className="text-xs text-gray-400 mt-0.5">Total space occupancy, month over month across all 5 locations</p>
      </div>
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Month</th>
            {LOCATIONS.map(loc => (
              <th key={loc} className={`px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide ${DATA_COL_WIDTH}`}>{loc}</th>
            ))}
            <th className={`px-4 py-2.5 text-right text-xs font-bold text-gray-600 uppercase tracking-wide border-l border-gray-200 ${DATA_COL_WIDTH}`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(({ month, byLocation }) => {
            const values = LOCATIONS.map(loc => byLocation[loc]).filter((v): v is number => v != null);
            const total = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
            return (
              <tr key={month} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-600">{month}</td>
                {LOCATIONS.map(loc => (
                  <td key={loc} className={`px-4 py-2 text-right tabular-nums text-xs font-medium text-gray-700 ${DATA_COL_WIDTH}`}>
                    {fmtPct(byLocation[loc])}
                  </td>
                ))}
                <td className={`px-4 py-2 text-right tabular-nums text-xs font-bold text-gray-800 border-l border-gray-200 bg-gray-50/60 ${DATA_COL_WIDTH}`}>
                  {fmtPct(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
