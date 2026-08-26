const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Sortable key for a "Mon YYYY" label (e.g. "Aug 2026"). Shared so every
 * "year-to-date-through-current-month" computation in the app filters
 * records the same way -- previously each YTD function (LocationSummaryTable's
 * computeYTD, OverviewPacket's computeYTDTotals/computeYTDLines) only
 * filtered by calendar year (`r.month.endsWith(yearStr)`), which silently
 * pulled in *every* month of the year regardless of the period being
 * viewed -- e.g. Jan 2026's "YTD" showed the full Jan-Aug total, identical
 * to Aug's. Found while adding YTD columns to the Revenue/Expense Mix
 * tables (Max, 2026-08-25) when Jan and Aug rendered the same YTD figure. */
export function monthSortKey(m: string): number {
  const [mon, yearStr] = m.split(" ");
  const idx = MONTH_ORDER.indexOf(mon);
  const year = parseInt(yearStr, 10);
  if (idx === -1 || isNaN(year)) return -Infinity;
  return year * 12 + idx;
}

/** Records from the same calendar year as `currentMonth`, up to and
 * including it -- the actual "year-to-date-through-current-month" window
 * every YTD computation in the app means to use. */
export function ytdRecordsThrough<T extends { month: string }>(records: T[], currentMonth: string): T[] {
  const [, yearStr] = currentMonth.split(" ");
  if (!yearStr) return [];
  const endKey = monthSortKey(currentMonth);
  return records.filter(r => r.month.endsWith(yearStr) && monthSortKey(r.month) <= endKey);
}
