"use client";

import { TrendPoint } from "@/types/dashboard";
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
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(0)}K`;
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Revenue, Gross Profit & NOI Trend</h3>
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#E07A3E" stopOpacity={0.06}/>
              <stop offset="95%" stopColor="#E07A3E" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="fillGP" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.05}/>
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
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
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#E07A3E"
            strokeWidth={2.5}
            fill="url(#fillRevenue)"
            dot={{ r: 3, fill: "#E07A3E", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="Revenue"
          />
          <Area
            type="monotone"
            dataKey="gp"
            stroke="#94a3b8"
            strokeWidth={2}
            fill="url(#fillGP)"
            dot={{ r: 3, fill: "#94a3b8", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="Gross Profit"
          />
          <Area
            type="monotone"
            dataKey="noi"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#fillNOI)"
            dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="NOI"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
