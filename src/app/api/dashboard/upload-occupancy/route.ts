import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const key = process.env.DASHBOARD_INTERNAL_KEY;
  if (!key) return false;
  return req.headers.get("x-dashboard-key") === key;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");
  const month = searchParams.get("month");
  if (!location || !month) {
    return NextResponse.json({ error: "Missing location or month query param" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("monthly_occupancy")
    .select("data")
    .eq("location", location)
    .eq("month", month)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ data: data.data });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const records = Array.isArray(body) ? body : [body];
  const supabase = createServiceClient();
  const results: { location: string; month: string; status: string }[] = [];

  for (const record of records) {
    const { location, month, lock } = record as { location: string; month: string; lock?: boolean };
    if (!location || !month) {
      results.push({ location: location ?? "?", month: month ?? "?", status: "missing location or month" });
      continue;
    }

    const { data: existing } = await supabase
      .from("monthly_occupancy")
      .select("locked")
      .eq("location", location)
      .eq("month", month)
      .single();

    if (existing?.locked) {
      results.push({ location, month, status: "locked — not updated" });
      continue;
    }

    // `lock` (set only by the month-end closing pull, never the daily live
    // pull) is written straight through -- once true, the guard above makes
    // this a one-way door per (location, month). Omitted entirely for
    // normal pushes so the upsert never resets an existing locked=true back
    // to false.
    const row: Record<string, unknown> = { location, month, data: record, uploaded_at: new Date().toISOString() };
    if (lock) row.locked = true;

    const { error } = await supabase
      .from("monthly_occupancy")
      .upsert(row, { onConflict: "location,month" });

    results.push({ location, month, status: error ? `error: ${error.message}` : "ok" });
  }

  return NextResponse.json({ results });
}
