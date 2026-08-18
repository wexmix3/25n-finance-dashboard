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

  const packet = body as { location: string; month: string; [key: string]: unknown };
  const { location, month } = packet;

  if (!location || !month) {
    return NextResponse.json({ error: "Missing location or month" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("monthly_packets")
    .upsert(
      { location, month, data: packet, generated_at: new Date().toISOString() },
      { onConflict: "location,month" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", location, month });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");
  const month = searchParams.get("month");

  const supabase = createServiceClient();
  let query = supabase.from("monthly_packets").select("*").order("generated_at", { ascending: false });

  if (location) query = query.eq("location", location);
  if (month) query = query.eq("month", month);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ packets: data });
}
