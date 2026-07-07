import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  // Accepts a single FinancialData object or an array of them
  const records = Array.isArray(body) ? body : [body];

  const supabase = createServiceClient();
  const results: { location: string; month: string; status: string }[] = [];

  for (const record of records) {
    const { location, month } = record as { location: string; month: string };
    if (!location || !month) {
      results.push({ location: location ?? "?", month: month ?? "?", status: "missing location or month" });
      continue;
    }

    // Upsert: update if the period isn't locked, reject if locked
    const { data: existing } = await supabase
      .from("monthly_financials")
      .select("locked")
      .eq("location", location)
      .eq("month", month)
      .single();

    if (existing?.locked) {
      results.push({ location, month, status: "locked — not updated" });
      continue;
    }

    const { error } = await supabase
      .from("monthly_financials")
      .upsert({ location, month, data: record, uploaded_at: new Date().toISOString() }, {
        onConflict: "location,month",
      });

    results.push({ location, month, status: error ? `error: ${error.message}` : "ok" });
  }

  return NextResponse.json({ results });
}
