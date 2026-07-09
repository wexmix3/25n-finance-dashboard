import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");
  const month = searchParams.get("month");

  const db = createServiceClient();

  if (location && month) {
    // Fetch current + prior for a specific location
    const { data, error } = await db
      .from("monthly_financials")
      .select("*")
      .eq("location", location)
      .in("month", [month, getPriorMonth(month)]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const records = [...(data ?? [])].sort((a, b) => monthSortKey(b.month) - monthSortKey(a.month));
    return NextResponse.json({ records });
  }

  if (location) {
    // Fetch last 12 months for trend chart, oldest → newest so charts read left-to-right chronologically.
    // `month` is a text column ("Jun 2026") — sorting it in SQL is lexicographic, not chronological
    // ("Apr" < "Feb" < "Jan" < "Jun" as strings), so the sort has to happen here on a parsed date.
    const { data, error } = await db
      .from("monthly_financials")
      .select("month, data")
      .eq("location", location);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const trend = [...(data ?? [])]
      .sort((a, b) => monthSortKey(b.month) - monthSortKey(a.month))
      .slice(0, 12)
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
    return NextResponse.json({ trend });
  }

  // Fetch latest month for all locations (overview)
  const { data: all, error } = await db
    .from("monthly_financials")
    .select("location, month, data, locked, uploaded_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return latest record per location — sorted by parsed date, not the text column
  // (same lexicographic-vs-chronological issue as above; picking "latest" via a raw
  // string sort was silently selecting the wrong month as current for any location
  // whose months span both halves of the alphabet, e.g. May before Jul).
  const sorted = [...(all ?? [])].sort((a, b) => monthSortKey(b.month) - monthSortKey(a.month));
  const latest: Record<string, unknown> = {};
  for (const row of sorted) {
    if (!latest[row.location]) latest[row.location] = row;
  }

  return NextResponse.json({ locations: Object.values(latest) });
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Jun 2026" -> 2026*12 + 5, so numeric comparison is chronological.
function monthSortKey(month: string): number {
  const [mon, yearStr] = month.split(" ");
  const idx = MONTH_NAMES.indexOf(mon);
  const year = parseInt(yearStr, 10);
  if (idx === -1 || isNaN(year)) return -Infinity;
  return year * 12 + idx;
}

function getPriorMonth(month: string): string {
  // "Jun 2026" → "May 2026"
  const [mon, yearStr] = month.split(" ");
  const year = parseInt(yearStr);
  const idx = MONTH_NAMES.indexOf(mon);
  if (idx === -1) return "";
  if (idx === 0) return `Dec ${year - 1}`;
  return `${MONTH_NAMES[idx - 1]} ${year}`;
}
