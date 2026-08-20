"use client";

import type { FinancialData, MonthlyRecord } from "@/types/dashboard";
import { LOCATIONS, Location } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";

function fmt(n: number): string {
  return formatCurrency(n, { compact: true });
}

function computeYTD(records: MonthlyRecord[], currentMonth: string): { revenue: number; ni: number } | null {
  const [, yearStr] = currentMonth.split(" ");
  if (!yearStr) return null;
  const ytd = records.filter(r => r.month.endsWith(yearStr));
  if (ytd.length === 0) return null;
  return ytd.reduce(
    (acc, r) => ({
      revenue: acc.revenue + (r.data?.income_statement?.revenue?._total?.actual ?? 0),
      ni: acc.ni + (r.data?.income_statement?.net_income?.actual ?? 0),
    }),
    { revenue: 0, ni: 0 }
  );
}

interface LocationSnapshot {
  current: { data?: FinancialData | null } | null;
  allRecords: MonthlyRecord[];
}

interface Props {
  locationData: Record<Location, LocationSnapshot>;
  selectedMonth?: string | null;
}

type CellResult = { text: string; color?: string };
type Snapshot = { d: FinancialData | null; records: MonthlyRecord[] };

// Every data column (5 locations + Consolidated) gets the same fixed width,
// so a wide value in one column (e.g. "-641.5%") doesn't visually shove its
// neighbors around — flagged by Christine 2026-08-19 ("equal preset column
// widths").
const DATA_COL_WIDTH = "w-28";

const metrics: {
  label: string;
  bold?: boolean;
  separator?: boolean;
  getValue: (d: FinancialData, records: MonthlyRecord[], currentMonth: string) => CellResult;
  getConsolidated: (snapshots: Snapshot[], currentMonth: string) => CellResult;
}[] = [
  {
    label: "Revenue",
    bold: true,
    getValue: d => ({ text: fmt(d.income_statement.revenue._total.actual) }),
    getConsolidated: snapshots => {
      const total = snapshots.reduce((sum, s) => sum + (s.d?.income_statement.revenue._total.actual ?? 0), 0);
      return { text: fmt(total) };
    },
  },
  {
    label: "Revenue vs Budget",
    getValue: d => {
      const rev = d.income_statement.revenue._total.actual;
      const bud = d.income_statement.revenue._total.budget;
      if (!bud) return { text: "—" };
      const diff = rev - bud;
      return { text: formatCurrency(diff, { compact: true, showSign: true }), color: diff >= 0 ? "text-emerald-600" : "text-red-600" };
    },
    getConsolidated: snapshots => {
      let rev = 0, bud = 0, hasBud = false;
      for (const s of snapshots) {
        rev += s.d?.income_statement.revenue._total.actual ?? 0;
        const b = s.d?.income_statement.revenue._total.budget ?? 0;
        if (b) hasBud = true;
        bud += b;
      }
      if (!hasBud) return { text: "—" };
      const diff = rev - bud;
      return { text: formatCurrency(diff, { compact: true, showSign: true }), color: diff >= 0 ? "text-emerald-600" : "text-red-600" };
    },
  },
  {
    label: "Total OPEX",
    getValue: d => ({ text: fmt(d.income_statement.opex._total.actual) }),
    getConsolidated: snapshots => {
      const total = snapshots.reduce((sum, s) => sum + (s.d?.income_statement.opex._total.actual ?? 0), 0);
      return { text: fmt(total) };
    },
  },
  {
    label: "Net Income",
    bold: true,
    separator: true,
    getValue: d => {
      const ni = d.income_statement.net_income.actual;
      return { text: fmt(ni), color: ni >= 0 ? "text-emerald-600" : "text-red-600" };
    },
    getConsolidated: snapshots => {
      const total = snapshots.reduce((sum, s) => sum + (s.d?.income_statement.net_income.actual ?? 0), 0);
      return { text: fmt(total), color: total >= 0 ? "text-emerald-600" : "text-red-600" };
    },
  },
  {
    label: "Net Income vs Budget",
    getValue: d => {
      const ni = d.income_statement.net_income.actual;
      const bud = d.income_statement.net_income.budget;
      if (!bud) return { text: "—" };
      const diff = ((ni - bud) / Math.abs(bud)) * 100;
      return { text: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%` };
    },
    getConsolidated: snapshots => {
      let ni = 0, bud = 0, hasBud = false;
      for (const s of snapshots) {
        ni += s.d?.income_statement.net_income.actual ?? 0;
        const b = s.d?.income_statement.net_income.budget ?? 0;
        if (b) hasBud = true;
        bud += b;
      }
      if (!hasBud || Math.abs(bud) < 2000) return { text: "—" };
      const diff = ((ni - bud) / Math.abs(bud)) * 100;
      return { text: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%` };
    },
  },
  {
    label: "YTD Revenue",
    bold: false,
    separator: true,
    getValue: (_d, records, currentMonth) => {
      const ytd = computeYTD(records, currentMonth);
      return ytd ? { text: fmt(ytd.revenue) } : { text: "—" };
    },
    getConsolidated: (snapshots, currentMonth) => {
      let total = 0, any = false;
      for (const s of snapshots) {
        const ytd = computeYTD(s.records, currentMonth);
        if (ytd) { total += ytd.revenue; any = true; }
      }
      return any ? { text: fmt(total) } : { text: "—" };
    },
  },
  {
    label: "YTD Net Income",
    bold: false,
    getValue: (_d, records, currentMonth) => {
      const ytd = computeYTD(records, currentMonth);
      if (!ytd) return { text: "—" };
      return { text: fmt(ytd.ni), color: ytd.ni >= 0 ? "text-emerald-600" : "text-red-600" };
    },
    getConsolidated: (snapshots, currentMonth) => {
      let total = 0, any = false;
      for (const s of snapshots) {
        const ytd = computeYTD(s.records, currentMonth);
        if (ytd) { total += ytd.ni; any = true; }
      }
      if (!any) return { text: "—" };
      return { text: fmt(total), color: total >= 0 ? "text-emerald-600" : "text-red-600" };
    },
  },
];

export function LocationSummaryTable({ locationData, selectedMonth }: Props) {
  const snapshots = LOCATIONS.map(loc => {
    const records = locationData[loc].allRecords;
    const record = selectedMonth
      ? (records.find(r => r.month === selectedMonth) ?? locationData[loc].current)
      : locationData[loc].current;
    return { loc, d: record?.data ?? null, records };
  });

  // Any location's current record supplies the month label for YTD grouping —
  // they're all on the same selected period by construction (Consolidated's
  // shared period selector).
  const anyMonth = snapshots.find(s => s.d)?.d?.month ?? selectedMonth ?? "";

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">All Locations — Snapshot</h3>
        <p className="text-xs text-gray-400 mt-0.5">Current-period MTD across all 5 locations</p>
      </div>
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-44">Metric</th>
            {LOCATIONS.map(loc => (
              <th key={loc} className={`px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide ${DATA_COL_WIDTH}`}>{loc}</th>
            ))}
            <th className={`px-4 py-2.5 text-right text-xs font-bold text-gray-600 uppercase tracking-wide border-l border-gray-200 ${DATA_COL_WIDTH}`}>Consolidated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {metrics.map(metric => {
            const consolidated = metric.getConsolidated(snapshots, anyMonth);
            return (
              <tr key={metric.label} className={`hover:bg-gray-50 ${metric.separator ? "border-t border-gray-200" : ""}`}>
                <td className={`px-4 py-2 text-xs text-gray-600 ${metric.bold ? "font-semibold" : "font-medium"}`}>
                  {metric.label}
                </td>
                {snapshots.map(({ loc, d, records }) => {
                  if (!d) {
                    return <td key={loc} className={`px-4 py-2 text-right text-xs text-gray-300 ${DATA_COL_WIDTH}`}>—</td>;
                  }
                  const currentMonth = d.month ?? selectedMonth ?? "";
                  const { text, color } = metric.getValue(d, records, currentMonth);
                  return (
                    <td key={loc} className={`px-4 py-2 text-right tabular-nums text-xs ${DATA_COL_WIDTH} ${metric.bold ? "font-semibold" : "font-medium"} ${color ?? "text-gray-700"}`}>
                      {text}
                    </td>
                  );
                })}
                <td className={`px-4 py-2 text-right tabular-nums text-xs border-l border-gray-200 bg-gray-50/60 ${DATA_COL_WIDTH} ${metric.bold ? "font-bold" : "font-semibold"} ${consolidated.color ?? "text-gray-800"}`}>
                  {consolidated.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
