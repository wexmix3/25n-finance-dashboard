"use client";

import { useState } from "react";

const MONTH_IDX = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonth(m: string): { mon: string; year: string; sortKey: number } {
  const [mon, year] = m.split(" ");
  return { mon, year, sortKey: parseInt(year, 10) * 12 + MONTH_IDX.indexOf(mon) };
}

interface Props {
  months: string[];
  active: string | null;
  onSelect: (month: string) => void;
  label?: string;
  /** Rendered as the first pill, selecting it calls onSelect(null-equivalent) — e.g. "Latest" */
  extraFirstPill?: { label: string; selected: boolean; onClick: () => void };
}

/**
 * Period selector: one row of month pills for a single year, oldest (Jan) on
 * the left through newest (Dec) on the right, with a year switcher above it
 * once data spans more than one year — keeps the row from growing unbounded
 * as historical/future months accumulate instead of one long alphabet-soup
 * scroll of every month ever pushed.
 */
export function PeriodPills({ months, active, onSelect, label = "Period", extraFirstPill }: Props) {
  const parsed = months.map(parseMonth);
  const years = Array.from(new Set(parsed.map(p => p.year))).sort();

  const defaultYear = active ? parseMonth(active).year : years[years.length - 1];
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const year = years.includes(selectedYear) ? selectedYear : years[years.length - 1];

  const yearMonths = parsed
    .filter(p => p.year === year)
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(p => `${p.mon} ${p.year}`);

  if (months.length <= 1 && !extraFirstPill) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide flex-shrink-0">{label}</span>

      {years.length > 1 && (
        <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded p-0.5 flex-shrink-0">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={[
                "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors duration-150 cursor-pointer",
                y === year ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600",
              ].join(" ")}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-nowrap pb-0.5">
        {extraFirstPill && (
          <button
            onClick={extraFirstPill.onClick}
            className={[
              "px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150 cursor-pointer flex-shrink-0",
              extraFirstPill.selected ? "bg-[#E07A3E] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
            ].join(" ")}
          >
            {extraFirstPill.label}
          </button>
        )}
        {yearMonths.map((month) => (
          <button
            key={month}
            onClick={() => onSelect(month)}
            className={[
              "px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150 cursor-pointer flex-shrink-0",
              active === month ? "bg-[#E07A3E] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200",
            ].join(" ")}
          >
            {month.split(" ")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
