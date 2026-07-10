import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Marks (or clears) a period's GL check as reviewed — purely a "someone looked
// at this" acknowledgment. Reversible, and never touches the underlying
// variance_flags/control_violations/journal_entry_accounts data, so nothing
// is lost by toggling it either way.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { location?: string; month?: string; reviewed?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { location, month, reviewed } = body;
  if (!location || !month || typeof reviewed !== "boolean") {
    return NextResponse.json({ error: "location, month, and reviewed (boolean) are required" }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from("monthly_financials")
    .update(
      reviewed
        ? { gl_reviewed: true, gl_reviewed_by: user.email, gl_reviewed_at: new Date().toISOString() }
        : { gl_reviewed: false, gl_reviewed_by: null, gl_reviewed_at: null }
    )
    .eq("location", location)
    .eq("month", month);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, location, month, reviewed });
}
