import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import type { Location, MonthlyRecord, TrendPoint } from "@/types/dashboard";
import { LOCATIONS } from "@/types/dashboard";

function getPriorMonth(month: string): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [mon, yearStr] = month.split(" ");
  const year = parseInt(yearStr);
  const idx = monthNames.indexOf(mon);
  if (idx === -1) return "";
  if (idx === 0) return `Dec ${year - 1}`;
  return `${monthNames[idx - 1]} ${year}`;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();

  // Fetch latest record per location (determines current month)
  const { data: allRecords } = await db
    .from("monthly_financials")
    .select("*")
    .order("month", { ascending: false });

  // Build per-location map of current + prior records
  type LocationData = {
    current: MonthlyRecord | null;
    prior: MonthlyRecord | null;
    trend: TrendPoint[];
  };

  const locationData: Record<Location, LocationData> = {} as Record<Location, LocationData>;

  for (const loc of LOCATIONS) {
    const locRecords: MonthlyRecord[] = (allRecords ?? []).filter((r: MonthlyRecord) => r.location === loc);

    const current = locRecords[0] ?? null;
    const priorMonth = current ? getPriorMonth(current.month) : null;
    const prior = priorMonth ? locRecords.find((r: MonthlyRecord) => r.month === priorMonth) ?? null : null;

    // Build trend from all available months (chronological)
    const trend: TrendPoint[] = locRecords
      .slice(0, 12)
      .reverse()
      .map((r: MonthlyRecord) => ({
        month: r.month,
        revenue: r.data?.income_statement?.revenue?._total?.actual ?? 0,
        noi: r.data?.income_statement?.net_operating_income?.actual ?? 0,
      }));

    locationData[loc] = { current, prior, trend };
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
      userEmail={user.email ?? ""}
      role={role}
    />
  );
}
