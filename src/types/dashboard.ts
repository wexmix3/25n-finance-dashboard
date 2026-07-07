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

export interface RevenueSection {
  memberships: LineItem;
  meeting_space: LineItem;
  mail_virtual: LineItem;
  other_services: LineItem;
  other_income: LineItem;
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
  admin_legal: LineItem;
  marketing: LineItem;
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

export interface FinancialData {
  location: Location;
  month: string;
  budget_aligned: boolean;
  reconciliation_notes: string[];
  income_statement: IncomeStatement;
  scope_note: string;
  insights?: string[];
}

export interface MonthlyRecord {
  id: string;
  location: Location;
  month: string;
  data: FinancialData;
  uploaded_at: string;
  locked: boolean;
}

export interface OccupancyData {
  location: Location;
  month: string;
  occupancy_pct?: number;
  total_members?: number;
  raw: Record<string, unknown>;
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
  noi: number;
}
