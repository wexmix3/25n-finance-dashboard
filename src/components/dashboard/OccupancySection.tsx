import type { OccupancyData } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";

interface Props {
  current: OccupancyData | null;
  prior: OccupancyData | null;
  expectedMonth?: string;
}

function delta(curr: number | undefined, prev: number | undefined): string | null {
  if (curr == null || prev == null || prev === 0) return null;
  const d = curr - prev;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
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

export function OccupancySection({ current, prior, expectedMonth }: Props) {
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

  const occDelta = delta(current.occupancy_pct ?? undefined, prior?.occupancy_pct ?? undefined);
  const memberDelta = deltaInt(current.total_members ?? undefined, prior?.total_members ?? undefined);

  const utilization =
    current.booked_desks != null && current.available_desks != null && current.available_desks > 0
      ? Math.round((current.booked_desks / current.available_desks) * 100)
      : null;

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
            <p className={`text-xs mt-0.5 ${occDelta.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}>
              {occDelta}pp MoM
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
            <p className={`text-xs mt-0.5 ${memberDelta.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}>
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
            <p className={`text-2xl font-semibold ${utilization >= 80 ? "text-emerald-600" : utilization >= 60 ? "text-yellow-600" : "text-red-500"}`}>
              {utilization}%
            </p>
            <p className="text-xs text-gray-400 mt-0.5">booked / available</p>
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
    </div>
  );
}
