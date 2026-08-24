import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import type { Location, MonthlyRecord, TrendPoint, OccupancyData, MonthlyPacket, GlItemReview, GlItemNote } from "@/types/dashboard";
import { LOCATIONS } from "@/types/dashboard";
import { normalizeFinancialData } from "@/lib/normalize-financial-data";

// Unlocked periods are still being written to by the GL/occupancy pipelines
// through the day — DashboardClient polls via router.refresh() while an
// unlocked period is on screen, which re-runs this server component. Force
// it to always re-read Supabase rather than let Vercel serve a cached
// render, or that polling would just re-fetch the same stale response.
export const dynamic = "force-dynamic";

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
    .select("location, month, data, uploaded_at");
  const occupancyRecords = [...(occupancyRecordsRaw ?? [])].sort(
    (a: { month: string }, b: { month: string }) => monthSortKey(b.month) - monthSortKey(a.month)
  );

  // "Is the daily Kube pull actually still running" is a different question
  // from "how old is the month being displayed" (the latter is expected to
  // be old when someone's intentionally browsing history). This checks the
  // freshness of THIS calendar month's occupancy row specifically, since
  // that's the one the daily automation is supposed to be touching today.
  const now = new Date();
  const currentCalendarMonth = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

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
    occupancyUploadedAt: string | null;
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
        ni: r.data?.income_statement?.net_income?.actual ?? 0,
      }));

    const locOccupancy = (occupancyRecords ?? []).filter((r: { location: string }) => r.location === loc);
    const occupancy: OccupancyData | null = locOccupancy[0]?.data ?? null;
    const occupancyUploadedAt: string | null =
      locOccupancy.find((r: { month: string; uploaded_at?: string }) => r.month === currentCalendarMonth)
        ?.uploaded_at ?? null;
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
      occupancyUploadedAt,
    };
  }

  // Per-location packet history — every generated packet, not just the
  // latest. A single "latest packet" silently showed the wrong period's
  // Balance Sheet/AR/AP/Cash Flow whenever a newer month's packet existed
  // (e.g. viewing April after May's packet was generated) — callers now
  // look up the packet matching whichever period is on screen.
  const packetData: Record<Location, MonthlyPacket[]> = {} as Record<Location, MonthlyPacket[]>;
  for (const loc of LOCATIONS) {
    packetData[loc] = (packetRecords ?? []).filter((r: MonthlyPacket) => r.location === loc);
  }

  // Get user role
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "viewer";

  // Per-item approve/keep-flagged status (GL Check panels). Table is small
  // (only ever holds explicitly-approved items — see migration comment), so
  // fetching everything up front and filtering client-side by
  // location/month/item_type is simpler than a query per panel render.
  const { data: glItemReviewsRaw } = await db
    .from("gl_item_reviews")
    .select("location, month, item_type, item_key, approved_by, approved_at");
  const glItemReviews: GlItemReview[] = glItemReviewsRaw ?? [];

  // Free-text notes, same up-front-fetch-and-filter-client-side pattern as
  // glItemReviews above — table only ever holds items someone actually
  // wrote a note on, so it stays small.
  const { data: glItemNotesRaw } = await db
    .from("gl_item_notes")
    .select("location, month, item_type, item_key, note, updated_by, updated_at");
  const glItemNotes: GlItemNote[] = glItemNotesRaw ?? [];

  return (
    <DashboardClient
      locationData={locationData}
      packetData={packetData}
      userEmail={user.email ?? ""}
      role={role}
      glItemReviews={glItemReviews}
      glItemNotes={glItemNotes}
    />
  );
}
