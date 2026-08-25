import type { FinancialData, IncomeStatement, LineItem } from "@/types/dashboard";

const ZERO: LineItem = { actual: 0, budget: 0, variance: 0 };

const REVENUE_KEYS: (keyof IncomeStatement["revenue"])[] = [
  "membership", "registration_access", "workspace_rental", "meeting_space",
  "package_revenue", "member_amenities", "miscellaneous", "_total",
];

const OPEX_KEYS: (keyof IncomeStatement["opex"])[] = [
  "payroll", "facilities", "insurance",
  "bad_debt", "depreciation", "license_business_fees", "professional_fees",
  "marketing", "meals_entertainment", "office_supplies", "technology", "travel",
  "utilities", "other", "_total",
];

/**
 * Backfills any revenue/OPEX category the current schema expects but an
 * older stored record doesn't have, with a zeroed LineItem.
 *
 * The revenue/OPEX category names changed (e.g. "memberships" ->
 * "workspace_rental" + others) to match Yardi's own account groupings. Only
 * newly-pushed records carry the new field names — every record already in
 * Supabase before that change (prior months, and any location not yet
 * repushed) is missing them entirely, which crashed every component that
 * reads e.g. `is.revenue.workspace_rental.actual` with "Cannot read
 * properties of undefined." This normalizes at the data-fetch boundary so
 * components never have to guard against a missing category — a record
 * from before the schema change just renders as zeros for the new fields
 * instead of crashing the page.
 */
export function normalizeIncomeStatement(is: IncomeStatement | null | undefined): IncomeStatement | null | undefined {
  if (!is) return is;

  const revenue = { ...is.revenue } as unknown as Record<string, LineItem>;
  for (const key of REVENUE_KEYS) {
    if (!revenue[key]) revenue[key] = ZERO;
  }

  const opex = { ...is.opex } as unknown as Record<string, LineItem>;
  for (const key of OPEX_KEYS) {
    if (!opex[key]) opex[key] = ZERO;
  }

  return {
    ...is,
    revenue: revenue as unknown as IncomeStatement["revenue"],
    opex: opex as unknown as IncomeStatement["opex"],
  };
}

export function normalizeFinancialData<T extends FinancialData | null | undefined>(data: T): T {
  if (!data) return data;
  return { ...data, income_statement: normalizeIncomeStatement(data.income_statement) } as T;
}
