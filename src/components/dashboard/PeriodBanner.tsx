"use client";

interface Props {
  currentMonth: string;
  priorMonth: string;
  uploadedAt?: string;
  locked?: boolean;
}

function computePacing(month: string, uploadedAt: string): { daysElapsed: number; daysInMonth: number } | null {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [monStr, yearStr] = month.split(" ");
  const monthIdx = monthNames.indexOf(monStr);
  const year = parseInt(yearStr);
  if (monthIdx === -1 || isNaN(year)) return null;
  // UTC throughout: the server (Vercel, UTC) and the browser (Eastern) would
  // otherwise read a different calendar day off the same timestamp whenever
  // an upload lands late evening Eastern (already past midnight UTC), which
  // makes the SSR'd text and the hydrated text disagree (React error #418).
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const uploadDate = new Date(uploadedAt);
  if (uploadDate.getUTCFullYear() === year && uploadDate.getUTCMonth() === monthIdx) {
    return { daysElapsed: uploadDate.getUTCDate(), daysInMonth };
  }
  // Upload is in a later month — this is a closed period, full month elapsed
  return { daysElapsed: daysInMonth, daysInMonth };
}

export function PeriodBanner({ currentMonth, priorMonth, uploadedAt, locked }: Props) {
  const pacing = uploadedAt && currentMonth !== "—" ? computePacing(currentMonth, uploadedAt) : null;
  const pacingPct = pacing ? Math.round((pacing.daysElapsed / pacing.daysInMonth) * 100) : null;
  const isFull = pacing ? pacing.daysElapsed === pacing.daysInMonth : false;

  const uploadLabel = uploadedAt
    ? `updated ${new Date(uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : "no data";

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 pb-3">
      <div className="flex items-center gap-5">
        {/* Current period */}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900">{currentMonth}</span>
          {isFull ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Final</span>
          ) : (
            <span className="text-xs font-semibold text-[#F15B27] bg-[#fdf2e9] px-1.5 py-0.5 rounded">MTD</span>
          )}
          {pacing && !isFull && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              Day {pacing.daysElapsed}/{pacing.daysInMonth}
              <span className="text-gray-400 font-normal">·</span>
              <span className="text-gray-600">{pacingPct}%</span>
            </span>
          )}
          <span className="text-xs text-gray-400">{uploadLabel}</span>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Prior period — read-only "Final" status, no lock/unlock controls
            (removed 2026-08-19: discretionary admin action, not daily-use
            navigation; data-integrity enforcement stays server-side). */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-400">{priorMonth}</span>
          {locked && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">
              Final
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
