import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import type { Location, MonthlyRecord, TrendPoint, OccupancyData, MonthlyPacket } from "@/types/dashboard";
import { LOCATIONS } from "@/types/dashboard";
import { normalizeFinancialData } from "@/lib/normalize-financial-data";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Jun 2026" -> 2026*12 + 5, so numeric comparison is chronological. `month` is
// stored as text, so ordering it in SQL ("Apr" < "Feb" < "Jan" < "Jun"...) is
// lexicographic, not calendar order — every consumer of these rows sorts here instead.
function monthSortKey(month: string): number {
  const [mon, yearStr] = month.split(" ");
  const idx = MONTH_NAMES.indexOf(mon);
  const year = parseInt(yearStr, 10);
  if (idx === -1 || isNaN(year)) return -Infinity;
  return year * 12 + idx;
}

function getPriorMonth(month: string): string {
  const [mon, yearStr] = month.split(" ");
  const year = parseInt(yearStr);
  const idx = MONTH_NAMES.indexOf(mon);
  if (idx === -1) return "";
  if (idx === 0) return `Dec ${year - 1}`;
  return `${MONTH_NAMES[idx - 1]} ${year}`;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();

  const { data: allRecordsRaw } = await db
    .from("monthly_financials")
    .select("*");
  const allRecords = [...(allRecordsRaw ?? [])]
    .sort((a: MonthlyRecord, b: MonthlyRecord) => monthSortKey(b.month) - monthSortKey(a.month))
    .map((r: MonthlyRecord) => ({ ...r, data: normalizeFinancialData(r.data) }));

  const { data: occupancyRecordsRaw } = await db
    .from("monthly_occupancy")
    .select("location, month, data");
  const occupancyRecords = [...(occupancyRecordsRaw ?? [])].sort(
    (a: { month: string }, b: { month: string }) => monthSortKey(b.month) - monthSortKey(a.month)
  );

  const { data: packetRecords } = await db
    .from("monthly_packets")
    .select("*")
    .order("generated_at", { ascending: false });

  type LocationData = {
    current: MonthlyRecord | null;
    prior: MonthlyRecord | null;
    trend: TrendPoint[];
    occupancy: OccupancyData | null;
    priorOccupancy: OccupancyData | null;
    allRecords: MonthlyRecord[];
    availableMonths: string[];
    allOccupancy: { month: string; data: OccupancyData }[];
  };

  const locationData: Record<Location, LocationData> = {} as Record<Location, LocationData>;

  for (const loc of LOCATIONS) {
    const locRecords: MonthlyRecord[] = (allRecords ?? []).filter((r: MonthlyRecord) => r.location === loc);

    const current = locRecords[0] ?? null;
    const priorMonth = current ? getPriorMonth(current.month) : null;
    const prior = priorMonth ? locRecords.find((r: MonthlyRecord) => r.month === priorMonth) ?? null : null;

    const trend: TrendPoint[] = locRecords
      .slice(0, 12)
      .reverse()
      .map((r: MonthlyRecord) => ({
        month: r.month,
        revenue: r.data?.income_statement?.revenue?._total?.actual ?? 0,
        gp: r.data?.income_statement?.gross_profit?.actual ?? 0,
        noi: r.data?.income_statement?.net_operating_income?.actual ?? 0,
      }));

    const locOccupancy = (occupancyRecords ?? []).filter((r: { location: string }) => r.location === loc);
    const occupancy: OccupancyData | null = locOccupancy[0]?.data ?? null;
    const priorOccMonth = occupancy?.month ? getPriorMonth(occupancy.month) : null;
    const priorOccupancy: OccupancyData | null = priorOccMonth
      ? (locOccupancy.find((r: { month: string }) => r.month === priorOccMonth)?.data ?? null)
      : null;

    locationData[loc] = {
      current,
      prior,
      trend,
      occupancy,
      priorOccupancy,
      allRecords: locRecords,
      availableMonths: locRecords.map((r: MonthlyRecord) => r.month),
      allOccupancy: locOccupancy.map((r: { month: string; data: OccupancyData }) => ({
        month: r.month,
        data: r.data,
      })),
    };
  }

  // Build per-location packet map (latest packet per location)
  const packetData: Record<Location, MonthlyPacket | null> = {} as Record<Location, MonthlyPacket | null>;
  for (const loc of LOCATIONS) {
    packetData[loc] = (packetRecords ?? []).find((r: MonthlyPacket) => r.location === loc) ?? null;
  }

  // Get user role
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "viewer";

  return (
    <DashboardClient
      locationData={locationData}
      packetData={packetData}
      userEmail={user.email ?? ""}
      role={role}
    />
  );
}
