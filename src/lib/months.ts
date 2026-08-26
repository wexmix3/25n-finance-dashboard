const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Sortable key for a "Mon YYYY" label (e.g. "Aug 2026"). */
export function monthSortKey(m: string): number {
  const [mon, yearStr] = m.split(" ");
  const idx = MONTH_ORDER.indexOf(mon);
  const year = parseInt(yearStr, 10);
  if (idx === -1 || isNaN(year)) return -Infinity;
  return year * 12 + idx;
}

/** Every record from the same calendar year as `currentMonth` -- YTD is
 * deliberately FLOATING (reflects the most current data on file, through
 * today, regardless of which historical period is being viewed), per Max's
 * explicit 2026-08-25 decision: "YTD stays floating... must reconcile to
 * the nightly Voyager MTD email — not frozen at last close." An earlier
 * version of this function gated on `monthSortKey(r.month) <= currentMonth`,
 * which "fixed" Jan 2026 showing the same YTD total as Aug into Jan showing
 * only its own month -- that reads correct in isolation but is exactly the
 * frozen-at-viewed-period behavior Max ruled out. Reverted 2026-08-25 after
 * he caught it live. */
export function ytdRecordsThrough<T extends { month: string }>(records: T[], currentMonth: string): T[] {
  const [, yearStr] = currentMonth.split(" ");
  if (!yearStr) return [];
  return records.filter(r => r.month.endsWith(yearStr));
}
