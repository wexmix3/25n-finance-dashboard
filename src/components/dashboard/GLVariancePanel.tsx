import type { VarianceFlag } from "@/types/dashboard";

interface Props {
  flags: VarianceFlag[];
  priorMonth: string;
}

function fmtK(v: number): string {
  const abs = Math.abs(v);
  const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}K` : `$${Math.round(abs).toLocaleString()}`;
  return v < 0 ? `(${str})` : str;
}

function fmtPct(v: number | null): string {
  if (v === null) return "new";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// Revenue accounts (4xxx) and GP/NOI — unfavorable when they go down
function isRevenueAccount(account: string): boolean {
  return account.startsWith("4") || account.startsWith("9");
}

export function GLVariancePanel({ flags, priorMonth }: Props) {
  if (flags.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">GL Variance Detail</h3>
        <p className="text-sm text-gray-400">No account-level flags — all clean vs {priorMonth}.</p>
      </div>
    );
  }

  // Chronological by account code (4xxx revenue before 6xxx/7xxx OPEX), not by variance size —
  // reads the way the chart of accounts does.
  const sorted = [...flags].sort((a, b) => a.account.localeCompare(b.account));

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">GL Variance Detail</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          vs {priorMonth} — {flags.length} account{flags.length !== 1 ? "s" : ""} flagged
        </p>
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] text-gray-500">
          <span className="font-semibold text-gray-600">Flag rule:</span>{" "}
          prior $0 → flag if current exceeds $500 (new activity) · prior over $1,000 → flag if change exceeds
          the larger of $500 or 20% of prior · prior $1–$1,000 → flag if change exceeds $500.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide w-16">Acct</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Description</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Prior</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Current</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Change</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">%</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Why flagged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((f) => {
              const unfav = isRevenueAccount(f.account) ? f.variance < 0 : f.variance > 0;
              return (
                <tr key={f.account} className="hover:bg-gray-50">
                  <td className="px-4 py-1.5 text-gray-400 font-mono">{f.account}</td>
                  <td className="px-4 py-1.5 text-gray-700 max-w-[200px] truncate">{f.name}</td>
                  <td className="px-4 py-1.5 text-right text-gray-500">{fmtK(f.prior)}</td>
                  <td className="px-4 py-1.5 text-right text-gray-700">{fmtK(f.current)}</td>
                  <td className={`px-4 py-1.5 text-right font-medium ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                    {f.variance > 0 ? "+" : ""}{fmtK(f.variance)}
                  </td>
                  <td className={`px-4 py-1.5 text-right ${unfav ? "text-red-600" : "text-emerald-600"}`}>
                    {fmtPct(f.variance_pct)}
                  </td>
                  <td className="px-4 py-1.5 text-gray-400 whitespace-nowrap">{f.rule_triggered}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
