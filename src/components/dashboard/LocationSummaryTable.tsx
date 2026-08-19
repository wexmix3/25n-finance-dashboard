"use client";

import type { FinancialData, MonthlyRecord } from "@/types/dashboard";
import { LOCATIONS, Location } from "@/types/dashboard";
import { InfoPopover } from "@/components/ui/InfoPopover";
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

const metrics: {
  label: string;
  bold?: boolean;
  separator?: boolean;
  info?: { title: string; formula?: string; source?: string; note?: string };
  getValue: (d: FinancialData, records: MonthlyRecord[], currentMonth: string) => CellResult;
}[] = [
  {
    label: "Revenue",
    bold: true,
    info: { title: "Total Revenue (MTD)", formula: "Sum of all revenue line items for the period", source: "Yardi Scheduler_Reports" },
    getValue: d => ({ text: fmt(d.income_statement.revenue._total.actual) }),
  },
  {
    label: "Revenue vs Budget",
    info: { title: "Revenue vs Budget (full-month)", formula: "Revenue − Full-Month Budget", note: "Always compared to the full-month budget, never prorated — most revenue is contractual and posts in full on the 1st." },
    getValue: d => {
      const rev = d.income_statement.revenue._total.actual;
      const bud = d.income_statement.revenue._total.budget;
      if (!bud) return { text: "—" };
      const diff = rev - bud;
      return { text: formatCurrency(diff, { compact: true, showSign: true }), color: diff >= 0 ? "text-emerald-600" : "text-red-500" };
    },
  },
  {
    label: "GP Margin %",
    info: { title: "Gross Profit Margin", formula: "Gross Profit ÷ Total Revenue × 100", source: "Computed by build_statements.py" },
    getValue: d => ({ text: `${d.income_statement.gross_profit.margin_pct.toFixed(1)}%` }),
  },
  {
    label: "Total OPEX",
    info: { title: "Total Operating Expenses", formula: "Payroll + Facilities + Admin + Marketing + Technology + Utilities + Other", source: "Yardi Scheduler_Reports, accounts 6000–6999" },
    getValue: d => ({ text: fmt(d.income_statement.opex._total.actual) }),
  },
  {
    label: "Net Income",
    bold: true,
    separator: true,
    info: { title: "Net Income", formula: "NOI + Other Income − Other Expenses", source: "Yardi Scheduler_Reports" },
    getValue: d => {
      const ni = d.income_statement.net_income.actual;
      return { text: fmt(ni), color: ni >= 0 ? "text-emerald-600" : "text-red-500" };
    },
  },
  {
    label: "Net Income vs Budget",
    info: { title: "Net Income vs Budget (full-month)", formula: "(MTD NI − Full-Month NI Budget) ÷ |Full NI Budget|", note: "Uses the full-month NI budget — not prorated. The KPI card above prorates to elapsed days; this row shows the raw gap from plan." },
    getValue: d => {
      const ni = d.income_statement.net_income.actual;
      const bud = d.income_statement.net_income.budget;
      if (!bud) return { text: "—" };
      const diff = ((ni - bud) / Math.abs(bud)) * 100;
      return { text: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%` };
    },
  },
  {
    label: "YTD Revenue",
    bold: false,
    separator: true,
    info: { title: "Year-to-Date Revenue", formula: "Sum of Revenue across all months in the current calendar year", source: "Computed from monthly_financials records in Supabase" },
    getValue: (_d, records, currentMonth) => {
      const ytd = computeYTD(records, currentMonth);
      return ytd ? { text: fmt(ytd.revenue) } : { text: "—" };
    },
  },
  {
    label: "YTD Net Income",
    bold: false,
    info: { title: "Year-to-Date Net Income", formula: "Sum of Net Income across all months in the current calendar year", source: "Computed from monthly_financials records in Supabase", note: "YTD Net Income accumulates — a single bad month reduces the YTD figure permanently." },
    getValue: (_d, records, currentMonth) => {
      const ytd = computeYTD(records, currentMonth);
      if (!ytd) return { text: "—" };
      return { text: fmt(ytd.ni), color: ytd.ni >= 0 ? "text-emerald-600" : "text-red-500" };
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">All Locations — Snapshot</h3>
        <p className="text-xs text-gray-400 mt-0.5">Current-period MTD across all 5 locations</p>
      </div>
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-44">Metric</th>
            {LOCATIONS.map(loc => (
              <th key={loc} className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">{loc}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {metrics.map(metric => (
            <tr key={metric.label} className={`hover:bg-gray-50 ${metric.separator ? "border-t border-gray-200" : ""}`}>
              <td className={`px-4 py-2 text-xs text-gray-600 ${metric.bold ? "font-semibold" : "font-medium"}`}>
                <span className="flex items-center">
                  {metric.label}
                  {metric.info && <InfoPopover {...metric.info} />}
                </span>
              </td>
              {snapshots.map(({ loc, d, records }) => {
                if (!d) {
                  return <td key={loc} className="px-4 py-2 text-right text-xs text-gray-300">—</td>;
                }
                const currentMonth = d.month ?? selectedMonth ?? "";
                const { text, color } = metric.getValue(d, records, currentMonth);
                return (
                  <td key={loc} className={`px-4 py-2 text-right tabular-nums text-xs ${metric.bold ? "font-semibold" : "font-medium"} ${color ?? "text-gray-700"}`}>
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
