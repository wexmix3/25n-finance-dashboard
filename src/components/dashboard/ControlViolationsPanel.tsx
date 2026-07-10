import type { ControlViolation } from "@/types/dashboard";

interface Props {
  violations: ControlViolation[];
}

function fmtK(v: number): string {
  const abs = Math.abs(v);
  const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}K` : `$${Math.round(abs).toLocaleString()}`;
  return v < 0 ? `(${str})` : str;
}

const ISSUE_LABEL: Record<string, string> = {
  wrong_control_prefix: "Unexpected control # prefix for this account",
  wrong_vendor: "Vendor on transaction doesn't match vendor of record",
  inactive_account_has_activity: "Inactive account has activity",
};

export function ControlViolationsPanel({ violations }: Props) {
  if (violations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Control # &amp; Vendor Issues</h3>
        <p className="text-sm text-gray-400">No control # or vendor mismatches — every transaction ties out correctly.</p>
      </div>
    );
  }

  const sorted = [...violations].sort((a, b) => a.account.localeCompare(b.account));

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Control # &amp; Vendor Issues</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {violations.length} transaction{violations.length !== 1 ? "s" : ""} — answers &ldquo;are the account #s correct&rdquo;
        </p>
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] text-gray-500">
          Every posted transaction should carry a Control # prefix appropriate for its account section
          (R = recurring/rent, K = cash disbursement, C = charge/revenue, J = journal entry, P = purchase/vendor payment).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide w-16">Acct</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Description</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Control #</th>
              <th className="px-4 py-2 text-right font-medium text-gray-400 uppercase tracking-wide">Amount</th>
              <th className="px-4 py-2 text-left font-medium text-gray-400 uppercase tracking-wide">Issue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((v, i) => (
              <tr key={`${v.account}-${v.control}-${i}`} className="hover:bg-gray-50">
                <td className="px-4 py-1.5 text-gray-400 font-mono">{v.account}</td>
                <td className="px-4 py-1.5 text-gray-700 max-w-[160px] truncate">{v.account_name}</td>
                <td className="px-4 py-1.5 text-gray-500 font-mono">{v.control}</td>
                <td className="px-4 py-1.5 text-right text-gray-700">{fmtK(v.amount)}</td>
                <td className="px-4 py-1.5 text-red-600">{ISSUE_LABEL[v.violation_type] ?? v.violation_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
