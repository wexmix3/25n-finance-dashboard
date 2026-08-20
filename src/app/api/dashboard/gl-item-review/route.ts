import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Per-item approve/keep-flagged toggle for GL Check's three flagged-item
// panels. Reversible by construction (Christine's 2026-08-19 ask, "you can
// undo an action if someone accidentally makes a mistake"): approving
// upserts a row, un-approving deletes it — "no row" and "never reviewed"
// are the same state, so there's nothing to reconcile either direction.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { location?: string; month?: string; item_type?: string; item_key?: string; approved?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { location, month, item_type, item_key, approved } = body;
  if (!location || !month || !item_type || !item_key || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "location, month, item_type, item_key, and approved (boolean) are required" },
      { status: 400 }
    );
  }
  if (!["variance", "control", "je"].includes(item_type)) {
    return NextResponse.json({ error: "item_type must be one of: variance, control, je" }, { status: 400 });
  }

  const db = createServiceClient();

  if (approved) {
    const { error } = await db
      .from("gl_item_reviews")
      .upsert(
        { location, month, item_type, item_key, approved_by: user.email, approved_at: new Date().toISOString() },
        { onConflict: "location,month,item_type,item_key" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db
      .from("gl_item_reviews")
      .delete()
      .eq("location", location)
      .eq("month", month)
      .eq("item_type", item_type)
      .eq("item_key", item_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, location, month, item_type, item_key, approved });
}
