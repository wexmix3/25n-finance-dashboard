"use client";

interface Props {
  /** Bold one-line takeaway — existing Haiku insights[0] text. */
  insight: string;
  /** Muted sub-detail line — insights[1] when the model produced a second observation. */
  detail?: string;
  /** Smallest, lightest caption — explains the mechanism behind `insight`
   * (e.g. what "on pace"/"off track" is actually measuring) so the headline
   * never reads as an unexplained verdict. */
  methodNote?: string;
  /** Action/link row below the insight, e.g. "View full P&L". */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Insight panel as its own card component (Reference Inspiration #1) —
 * replaces the plain headline sentence that used to sit directly in
 * Overview's hero. Small icon, "Today's Key Insight" label, bold takeaway,
 * optional muted sub-detail, and an action link row.
 */
export function InsightPanel({ insight, detail, methodNote, actionLabel, onAction }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#fdf2e9] flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-[#F15B27]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
          </svg>
        </span>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today&apos;s Key Insight</p>
      </div>
      <p className="text-base font-semibold text-gray-900 leading-snug">{insight}</p>
      {detail && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{detail}</p>}
      {methodNote && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{methodNote}</p>}
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#F15B27] hover:underline cursor-pointer"
        >
          {actionLabel}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      )}
    </div>
  );
}
