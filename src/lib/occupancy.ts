import type { OccupancyData } from "@/types/dashboard";

/** Every occupancy percentage in the app renders through this one formatter
 * so "XX.X%" precision is consistent everywhere -- previously each call site
 * rounded independently (some `Math.round`, some raw), so the same data
 * showed as "80%" in one table and "80.0%" nowhere, or "86.7%" next to a
 * whole-number "67%" in the same column. Flagged by Max 2026-08-25. */
export function fmtOccPct(v: number | null | undefined, digits = 1): string {
  return v != null ? `${v.toFixed(digits)}%` : "—";
}

/** Which occupancy figure a caller wants: the blended Total Space number,
 * or one of the two space-type breakouts Christine cares about most. */
export type OccupancyMetric = "total" | "private_office" | "dedicated_desk";

// Space-type prefixes matching the CORE_TYPE_PREFIXES convention already
// used in parse_kube_api_occupancy.py / push_manual_occupancy.py -- handles
// per-sub-location suffixed names too (e.g. Schaumburg's Kube data reports
// "Private Office - Huddle Up" and "Private Office - Amara Club" as
// separate entries, both need to roll into one Private Office figure).
const SPACE_TYPE_PREFIX: Record<Exclude<OccupancyMetric, "total">, string> = {
  private_office: "Private Office",
  dedicated_desk: "Dedicated Desk",
};

function matchingBreakdown(data: OccupancyData | null | undefined, metric: Exclude<OccupancyMetric, "total">) {
  const prefix = SPACE_TYPE_PREFIX[metric];
  return (data?.raw.space_breakdown ?? []).filter(sb => sb.space_type.startsWith(prefix));
}

/** Reads one occupancy metric off a record, in priority order: (1) Total
 * Space's own field, (2) an explicit backfilled percentage (the only option
 * for Jan-Jul, which came from Tracey's file as a rate with no per-unit
 * counts), (3) aggregated from space_breakdown's real unit counts (Kube-
 * sourced live months only -- Aug 2026 onward).
 *
 * A literal 0% is canonicalized to null (same as "never reported"), not
 * displayed as a real zero -- confirmed with Max 2026-08-25 using Uptown as
 * the concrete case: it's pre-opening, so a bare "0%" reads as "empty and
 * failing" when the truth is "hasn't opened yet, nothing to measure." Same
 * convention already used for hardcoded financial-statement zeros
 * (rendered as "-", not "0"). Applies to every location uniformly, not just
 * Uptown -- no other active location has posted a real 0% in this dataset,
 * so this can't currently hide a genuine occupancy-collapse signal, but
 * revisit this rule if one ever does.
 *
 * Shared by the Consolidated occupancy tables and the per-location
 * Occupancy tab so both read "occupancy" the same way -- previously each
 * had its own copy and the Consolidated hero card's average silently drifted
 * out of sync with this rule (flagged in Christine's 2026-08-24 feedback,
 * not yet fixed as of this shared-extraction pass). */
export function occupancyMetricValue(data: OccupancyData | null | undefined, metric: OccupancyMetric): number | null {
  if (!data) return null;

  let value: number | null;
  if (metric === "total") {
    value = data.occupancy_pct ?? null;
  } else {
    const explicit = metric === "private_office" ? data.raw.private_office_pct : data.raw.dedicated_desk_pct;
    if (explicit != null) {
      value = explicit;
    } else {
      const matching = matchingBreakdown(data, metric);
      if (matching.length === 0) {
        value = null;
      } else {
        const total = matching.reduce((sum, sb) => sum + sb.total_units, 0);
        const occupied = matching.reduce((sum, sb) => sum + sb.occupied_units, 0);
        value = total > 0 ? Math.round((occupied / total) * 1000) / 10 : null;
      }
    }
  }

  return value === 0 ? null : value;
}

/** Real occupied/total unit counts for a space-type metric, when Kube's
 * per-unit breakdown is available (live months only -- backfilled Jan-Jul
 * months only carry the rate, not counts, so this returns null there). */
export function occupancyMetricUnits(data: OccupancyData | null | undefined, metric: Exclude<OccupancyMetric, "total">): { occupied: number; total: number } | null {
  const matching = matchingBreakdown(data, metric);
  if (matching.length === 0) return null;
  const total = matching.reduce((sum, sb) => sum + sb.total_units, 0);
  const occupied = matching.reduce((sum, sb) => sum + sb.occupied_units, 0);
  if (total === 0) return null;
  return { occupied: Math.round(occupied), total: Math.round(total) };
}
