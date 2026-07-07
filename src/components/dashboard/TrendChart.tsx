"use client";

import { TrendPoint } from "@/types/dashboard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

  // Recharts renders newest first if data is descending; reverse to chronological
  const chartData = [...data].reverse();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">12-Month Revenue & NOI Trend</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value, name) => [fmtK(Number(value ?? 0)), name === "revenue" ? "Revenue" : "NOI"]}
            labelStyle={{ fontSize: 12, fontWeight: 600 }}
            contentStyle={{ fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Revenue"
          />
          <Line
            type="monotone"
            dataKey="noi"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="NOI"
            strokeDasharray={undefined}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
