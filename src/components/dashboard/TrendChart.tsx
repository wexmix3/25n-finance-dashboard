"use client";

import { TrendPoint } from "@/types/dashboard";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: TrendPoint[];
}

function fmtK(n: number): string {
  return formatCurrency(n, { compact: true, zeroDash: false });
}

// Current-period emphasis (Reference Inspiration #3): the current/selected
// month's marker renders solid orange across all three lines, every other
// month renders as a small pale-gray dot — draws the eye to "now" without a
// second legend. Line stroke colors are unchanged; this only touches dots.
function makeDot(lastIndex: number) {
  return function CurrentPeriodDot(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props;
    if (cx == null || cy == null || index == null) return <g />;
    const isCurrent = index === lastIndex;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isCurrent ? 5 : 2.5}
        fill={isCurrent ? "#F15B27" : "#d1d5db"}
        stroke={isCurrent ? "#ffffff" : "none"}
        strokeWidth={isCurrent ? 1.5 : 0}
      />
    );
  };
}

const LEGEND_ITEMS = [
  { label: "Revenue", color: "#F15B27" },
  { label: "Gross Profit", color: "#9ca3af" },
  { label: "NOI", color: "#10b981" },
];

function renderLegend() {
  return (
    <ul className="flex items-center justify-center gap-4 pt-2 list-none m-0 p-0">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: "#374151" }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-center h-56">
        <p className="text-sm text-gray-400">No trend data yet — upload multiple months to see the chart.</p>
      </div>
    );
  }

  const chartData = data;
  const lastIndex = chartData.length - 1;
  const currentDot = makeDot(lastIndex);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Revenue, Gross Profit & NOI Trend</h3>
      <ResponsiveContainer width="100%" height={360} debounce={200}>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F15B27" stopOpacity={0.06}/>
              <stop offset="95%" stopColor="#F15B27" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="fillGP" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.05}/>
              <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="fillNOI" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.05}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f4" />
          <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1.5} label={{ value: "$0", position: "insideTopLeft", fontSize: 10, fill: "#9ca3af" }} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: string) => {
              const [mon, year] = v.split(" ");
              return year ? `${mon} '${year.slice(2)}` : mon;
            }}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value, name) => [fmtK(Number(value ?? 0)), name as string]}
            labelStyle={{ fontSize: 12, fontWeight: 600 }}
            contentStyle={{ fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
          {/* Custom legend content — Recharts' default legend order doesn't
              reliably follow JSX child order for this chart type, so it was
              rendering "Gross Profit, NOI, Revenue" while the chart visually
              stacks Revenue/GP on top and NOI as a separate lower line.
              Rendering our own fixed order/colors guarantees Revenue,
              Gross Profit, NOI regardless of internal render order (v3's
              public Legend props omit a settable `payload`, so a custom
              `content` renderer is the supported way to force this). */}
          <Legend wrapperStyle={{ fontSize: 12 }} content={renderLegend} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#F15B27"
            strokeWidth={2.5}
            fill="url(#fillRevenue)"
            dot={currentDot}
            activeDot={{ r: 6 }}
            name="Revenue"
          />
          {/* De-emphasized relative to Revenue/NOI (thinner + dashed) — on
              high-margin locations (e.g. ~95-99% gross margin) this line
              sits almost on top of Revenue, so a matching stroke weight
              wastes a third of the chart's visual weight on a line that's
              barely distinguishable from the one above it. */}
          <Area
            type="monotone"
            dataKey="gp"
            stroke="#9ca3af"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            fill="url(#fillGP)"
            dot={currentDot}
            activeDot={{ r: 5 }}
            name="Gross Profit"
          />
          <Area
            type="monotone"
            dataKey="noi"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#fillNOI)"
            dot={currentDot}
            activeDot={{ r: 6 }}
            name="NOI"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
