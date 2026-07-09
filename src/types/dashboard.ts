export type Location = "Frisco" | "Geneva" | "Waco" | "Schaumburg" | "Uptown";

export const LOCATIONS: Location[] = ["Frisco", "Geneva", "Waco", "Schaumburg", "Uptown"];

export interface LineItem {
  actual: number;
  budget: number;
  variance: number;
}

export interface GrossProfit extends LineItem {
  margin_pct: number;
}

export interface NOI extends LineItem {
  margin_pct: number;
}

export interface NetIncome {
  actual: number;
  margin_pct: number;
}

// Mirrors Yardi's own 4x00 section headers 1:1 so revenue ties to Yardi's
// subtotal rows automatically and matches how Christine wants it broken out.
export interface RevenueSection {
  membership: LineItem;
  registration_access: LineItem;
  workspace_rental: LineItem;
  meeting_space: LineItem;
  package_revenue: LineItem;
  member_amenities: LineItem;
  miscellaneous: LineItem;
  _total: LineItem;
}

export interface COSSection {
  direct_cos: LineItem;
  community: LineItem;
  _total: LineItem;
}

export interface OPEXSection {
  payroll: LineItem;
  facilities: LineItem;
  // Yardi files this as its own "6800 Insurance" section, separate from Facilities.
  insurance: LineItem;
  admin_legal: LineItem;
  marketing: LineItem;
  // Yardi's own "7100 Meals and Entertainment" section, separate from Office Expense.
  meals_entertainment: LineItem;
  office_supplies: LineItem;
  technology: LineItem;
  travel: LineItem;
  utilities: LineItem;
  other: LineItem;
  _total: LineItem;
}

export interface IncomeStatement {
  revenue: RevenueSection;
  cos: COSSection;
  gross_profit: GrossProfit;
  opex: OPEXSection;
  net_operating_income: NOI;
  other_income_expense: {
    other_income: LineItem;
    other_expense: LineItem;
    _total: LineItem;
  };
  net_income: NetIncome;
}

export interface VarianceFlag {
  account: string;
  name: string;
  prior: number;
  current: number;
  variance: number;
  variance_pct: number | null;
  threshold_used: number;
  rule_triggered: string;
  equity_account?: boolean;
}

export interface FinancialData {
  location: Location;
  month: string;
  budget_aligned: boolean;
  reconciliation_notes: string[];
  income_statement: IncomeStatement;
  scope_note: string;
  insights?: string[];
  variance_flags?: VarianceFlag[];
}

export interface MonthlyRecord {
  id: string;
  location: Location;
  month: string;
  data: FinancialData;
  uploaded_at: string;
  locked: boolean;
}

export interface OccupancySpaceType {
  space_type: string;
  total_units: number;
  occupied_units: number;
  occupancy_rate: number;
  monthly_revenue: number;
}

export interface OccupancyData {
  location: Location;
  month: string;
  occupancy_pct?: number;
  total_members?: number;
  available_desks?: number;
  booked_desks?: number;
  raw: {
    contract_revenue?: number;
    ytd_occupancy_pct?: number;
    ytd_revenue?: number;
    space_breakdown?: OccupancySpaceType[];
    source_file?: string;
    [key: string]: unknown;
  };
}

export interface DashboardState {
  location: Location;
  currentMonth: string;
  priorMonth: string;
  current: FinancialData | null;
  prior: FinancialData | null;
  trend: TrendPoint[];
  occupancy: OccupancyData | null;
}

export interface TrendPoint {
  month: string;
  revenue: number;
  gp: number;
  noi: number;
}

// Financial Packet types (Phase 3 — from build_packet.py output)

export interface BSGroup {
  total: number;
  accounts: { code: string; description: string; balance: number; group: string }[];
}

export interface BSSummary {
  cash_and_bank: number;
  receivables: number;
  prepaid_and_other: number;
  fixed_assets: number;
  other_assets: number;
  total_assets: number;
  current_liabilities: number;
  long_term_liabilities: number;
  equity: number;
  total_liabilities_and_equity: number;
  balance_check: number;
}

export interface BalanceSheetData {
  summary: BSSummary;
  source_file?: string;
  error?: string;
}

export interface AgingBucket {
  current: number;
  d0_30: number;
  d31_60: number;
  d61_90: number;
  over_90: number;
  total_owed: number;
}

export interface ARAgingData {
  customer_count: number;
  transaction_count: number;
  totals: AgingBucket;
  delinquent_customers: { customer: string; d61_90: number; over_90: number }[];
  source_file?: string;
  error?: string;
}

export interface APVendor {
  payee_name: string;
  current: number;
  d0_30: number;
  d31_60: number;
  d61_90: number;
  over_90: number;
}

export interface APAgingData {
  vendor_count: number;
  transaction_count: number;
  // "current" is the invoice face value on every line (not a distinct aging
  // bucket the way 0-30/31-60/etc are) — it's already reflected inside the
  // other buckets, so total_owed excludes it and it should not be shown as
  // its own "total outstanding" summary tile.
  totals: AgingBucket & { future: number };
  overdue_vendors: Record<string, APVendor>;
  overdue_count: number;
  source_file?: string;
  error?: string;
}

export interface CashFlowData {
  account: string;
  description: string;
  beginning_cash: number;
  net_cash_flow: number;
  ending_cash: number;
  net_cash_flow_ytd?: number;
  ytd_months_included?: string[];
  ytd_complete?: boolean;
  source_file?: string;
  error?: string;
}

export interface FinancialPacket {
  location: string;
  property_code: string;
  month: string;
  generated_at: string;
  data_complete: boolean;
  missing_sources: string[];
  income_statement: IncomeStatement;
  balance_sheet: BalanceSheetData;
  ar_aging: ARAgingData;
  ap_aging: APAgingData;
  cash_flow: CashFlowData;
}

export interface MonthlyPacket {
  id: string;
  location: Location;
  month: string;
  data: FinancialPacket;
  generated_at: string;
}
