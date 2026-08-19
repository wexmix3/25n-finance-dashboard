/**
 * Shared alert banner — was 3 near-duplicate inline `bg-amber-50` JSX blocks
 * across DashboardClient (stale-data warning, reconciliation-flag banner,
 * occupancy-stale warning), each with its own copy of the same icon/border/
 * padding markup. One component now, plus a helper (below) that caps how
 * many render at once so a location with multiple active warnings doesn't
 * stack 2-3 identical-looking amber banners on one page.
 */
interface AlertBannerProps {
  severity?: "warning";
  message: string;
  title?: string;
  className?: string;
}

export function AlertBanner({ message, title, className }: AlertBannerProps) {
  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-start gap-2.5 ${className ?? ""}`}>
      <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <div>
        {title && <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">{title}</p>}
        <p className="text-xs text-amber-800 font-medium">{message}</p>
      </div>
    </div>
  );
}

export interface AlertBannerItem {
  key: string;
  title?: string;
  message: string;
}

/**
 * Renders at most one banner (the first/highest-priority item in the array
 * — callers order `items` by severity) plus a "+N more" affordance if more
 * are active, instead of stacking every active warning. All warnings on
 * this dashboard are currently the same "amber" severity, so priority here
 * is just array order, not an invented severity hierarchy.
 */
export function AlertBannerStack({ items }: { items: AlertBannerItem[] }) {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <AlertBanner
      title={first.title}
      message={rest.length > 0 ? `${first.message} (+${rest.length} more)` : first.message}
    />
  );
}
