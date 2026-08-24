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

// Subtle per-location identity color, distinct from the health-status
// palette (emerald/amber/red are already "on track / at risk / off track"
// elsewhere in the shell -- reusing any of them here would misread as a
// health signal on an occupancy table). Light enough to read as a column
// accent, not a status.
const LOCATION_ACCENT: Record<Location, { dot: string; bg: string }> = {
  Frisco: { dot: "bg-sky-400", bg: "bg-sky-50/50" },
  Geneva: { dot: "bg-violet-400", bg: "bg-violet-50/50" },
  Waco: { dot: "bg-teal-400", bg: "bg-teal-50/50" },
  Schaumburg: { dot: "bg-rose-400", bg: "bg-rose-50/50" },
  Uptown: { dot: "bg-indigo-400", bg: "bg-indigo-50/50" },
};

function fmtPct(v: number | null | undefined): string {
  return v != null ? `${Math.round(v)}%` : "—";
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function OccupancyHistoryTable({ rows }: Props) {
  if (rows.length === 0) return null;

  // Grand-total row (bottom, bolded) -- per-location average across every
  // month shown, plus an overall blended average in the Total column. This
  // is the summary Christine's own tracker puts at the bottom of its table
  // ("Monthly Average" row), not a per-month column.
  const locationAverages = Object.fromEntries(
    LOCATIONS.map(loc => [loc, average(rows.map(r => r.byLocation[loc]).filter((v): v is number => v != null))])
  ) as Record<Location, number | null>;
  const overallAverage = average(Object.values(locationAverages).filter((v): v is number => v != null));

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">Occupancy by Location — 2026</h3>
        <p className="text-xs text-gray-400 mt-0.5">Total space occupancy, month over month across all 5 locations</p>
      </div>
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-28 border-r border-gray-100">Month</th>
            {LOCATIONS.map(loc => (
              <th key={loc} className={`px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-100 ${DATA_COL_WIDTH}`}>
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <span className={`w-1.5 h-1.5 rounded-full ${LOCATION_ACCENT[loc].dot}`} />
                  {loc}
                </span>
              </th>
            ))}
            <th className={`px-4 py-2.5 text-right text-xs font-bold text-gray-600 uppercase tracking-wide ${DATA_COL_WIDTH}`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(({ month, byLocation }) => {
            const values = LOCATIONS.map(loc => byLocation[loc]).filter((v): v is number => v != null);
            const total = average(values);
            return (
              <tr key={month} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs font-medium text-gray-600 border-r border-gray-100">{month}</td>
                {LOCATIONS.map(loc => (
                  <td key={loc} className={`px-4 py-2 text-right tabular-nums text-xs font-medium text-gray-700 border-r border-gray-100 ${LOCATION_ACCENT[loc].bg} ${DATA_COL_WIDTH}`}>
                    {fmtPct(byLocation[loc])}
                  </td>
                ))}
                <td className={`px-4 py-2 text-right tabular-nums text-xs font-semibold text-gray-700 ${DATA_COL_WIDTH}`}>
                  {fmtPct(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="px-4 py-2.5 text-xs font-bold text-gray-900 border-r border-gray-200">Average</td>
            {LOCATIONS.map(loc => (
              <td key={loc} className={`px-4 py-2.5 text-right tabular-nums text-xs font-bold text-gray-900 border-r border-gray-200 ${DATA_COL_WIDTH}`}>
                {fmtPct(locationAverages[loc])}
              </td>
            ))}
            <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-bold text-gray-900 ${DATA_COL_WIDTH}`}>
              {fmtPct(overallAverage)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
