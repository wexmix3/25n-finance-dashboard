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
      .in("month", [month, getPriorMonth(month)])
      .order("month", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ records: data });
  }

  if (location) {
    // Fetch last 12 months for trend chart
    const { data, error } = await db
      .from("monthly_financials")
      .select("month, data")
      .eq("location", location)
      .order("month", { ascending: false })
      .limit(12);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ trend: data });
  }

  // Fetch latest month for all locations (overview)
  const { data: all, error } = await db
    .from("monthly_financials")
    .select("location, month, data, locked, uploaded_at")
    .order("month", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return latest record per location
  const latest: Record<string, unknown> = {};
  for (const row of (all ?? [])) {
    if (!latest[row.location]) latest[row.location] = row;
  }

  return NextResponse.json({ locations: Object.values(latest) });
}

function getPriorMonth(month: string): string {
  // "Jun 2026" → "May 2026"
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [mon, yearStr] = month.split(" ");
  const year = parseInt(yearStr);
  const idx = monthNames.indexOf(mon);
  if (idx === -1) return "";
  if (idx === 0) return `Dec ${year - 1}`;
  return `${monthNames[idx - 1]} ${year}`;
}
