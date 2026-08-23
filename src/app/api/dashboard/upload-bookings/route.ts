import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Raw storage for Kube API bookings/reservations -- NOT read by any
// dashboard UI yet. Same auth/upsert pattern as upload-occupancy, minus
// the locked-period guard (nothing here gets month-end locked; this is
// just accumulating history until it's wired into a real feature).

function isAuthorized(req: NextRequest): boolean {
  const key = process.env.DASHBOARD_INTERNAL_KEY;
  if (!key) return false;
  return req.headers.get("x-dashboard-key") === key;
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
    const { location, month } = record as { location: string; month: string };
    if (!location || !month) {
      results.push({ location: location ?? "?", month: month ?? "?", status: "missing location or month" });
      continue;
    }

    const { error } = await supabase
      .from("monthly_bookings")
      .upsert(
        { location, month, data: record, uploaded_at: new Date().toISOString() },
        { onConflict: "location,month" }
      );

    results.push({ location, month, status: error ? `error: ${error.message}` : "ok" });
  }

  return NextResponse.json({ results });
}
