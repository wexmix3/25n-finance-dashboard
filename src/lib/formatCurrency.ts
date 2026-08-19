/**
 * Single shared currency formatter for the whole app — enforces accounting
 * format everywhere a dollar figure is rendered: negatives always as
 * `$(1,234)`, never `-$1,234`. Every currency call site should route through
 * this instead of a local ad hoc formatter.
 *
 * Before this utility existed, at least 8 components each had their own
 * near-duplicate `fmt`/`fmtK`/`fmtDollar`/`fmt$` — some used `-$x`, some used
 * `($x)`, inconsistently. This is the migration target for all of them.
 */

export interface FormatCurrencyOptions {
  /** Render as $63K / $1.2M instead of the full $63,000 / $1,234,567. */
  compact?: boolean;
  /** Prefix positive values with "+" — used for variance/delta columns. */
  showSign?: boolean;
  /** Render an exact-zero value as an em dash instead of "$0". Default true. */
  zeroDash?: boolean;
}

export function formatCurrency(n: number, opts: FormatCurrencyOptions = {}): string {
  const { compact = false, showSign = false, zeroDash = true } = opts;

  if (n === 0 && zeroDash) return "—";

  const abs = Math.abs(n);
  let body: string;

  if (compact) {
    if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(1)}M`;
    else if (abs >= 1_000) body = `$${(abs / 1_000).toFixed(0)}K`;
    else body = `$${abs.toFixed(0)}`;
  } else {
    body = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  if (n < 0) return `(${body})`;
  return showSign ? `+${body}` : body;
}

/** Percent-point / percent delta formatter — same "+" convention as
 * formatCurrency's showSign, kept separate since percentages never need
 * accounting-parens treatment. */
export function formatSignedPct(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** Below this revenue magnitude, a margin % (X ÷ revenue) explodes into
 * noise — e.g. a location with ~$10 of revenue against $20K+ OPEX prints
 * Net Margin as -214548.9%, which reads as broken rather than "real math on
 * a tiny number." Same guard pattern as IncomeKpiRow's PCT_DENOMINATOR_FLOOR
 * for budget variance, but keyed on revenue since margin = X ÷ revenue. */
export const MARGIN_REVENUE_FLOOR = 2000;

/** Format a margin percentage, falling back to a low-revenue notice instead
 * of a six-digit percent when revenue is too small to carry a meaningful
 * ratio. `digits` controls precision when the percent is shown. */
export function formatMarginPct(marginPct: number, revenue: number, digits = 1): string {
  if (Math.abs(revenue) < MARGIN_REVENUE_FLOOR) return "N/A · low revenue";
  return `${marginPct.toFixed(digits)}%`;
}
