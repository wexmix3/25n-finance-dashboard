import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Free-text note on a single GL Check flagged item. Independent of
// gl_item_reviews (approve/reject) — a note can exist on an item that
// isn't approved, or on one that is. Saving an empty/whitespace-only note
// deletes the row, same reversible-by-construction pattern as approve/reject:
// "no row" and "no note" are the same state.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { location?: string; month?: string; item_type?: string; item_key?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { location, month, item_type, item_key } = body;
  const note = (body.note ?? "").trim();
  if (!location || !month || !item_type || !item_key) {
    return NextResponse.json(
      { error: "location, month, item_type, and item_key are required" },
      { status: 400 }
    );
  }
  if (!["variance", "control", "je"].includes(item_type)) {
    return NextResponse.json({ error: "item_type must be one of: variance, control, je" }, { status: 400 });
  }
  if (note.length > 500) {
    return NextResponse.json({ error: "note must be 500 characters or fewer" }, { status: 400 });
  }

  const db = createServiceClient();

  if (note) {
    const { error } = await db
      .from("gl_item_notes")
      .upsert(
        { location, month, item_type, item_key, note, updated_by: user.email, updated_at: new Date().toISOString() },
        { onConflict: "location,month,item_type,item_key" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db
      .from("gl_item_notes")
      .delete()
      .eq("location", location)
      .eq("month", month)
      .eq("item_type", item_type)
      .eq("item_key", item_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, location, month, item_type, item_key, note });
}
