import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Proxy to report-generator PDF endpoint.
// Auth key stays server-side — never exposed to the client.
export async function POST(request: NextRequest) {
  const reportGenUrl = process.env.REPORT_GENERATOR_URL;
  const apiKey = process.env.MONTH_CLOSE_API_KEY;

  if (!reportGenUrl || !apiKey) {
    return NextResponse.json(
      { error: "REPORT_GENERATOR_URL or MONTH_CLOSE_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resp = await fetch(`${reportGenUrl.replace(/\/$/, "")}/api/generate-financial-packet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: `PDF generation failed: ${text}` }, { status: resp.status });
  }

  const pdfBuffer = await resp.arrayBuffer();
  const location = (body as { location?: string })?.location ?? "location";
  const month = (body as { month?: string })?.month ?? "month";
  const filename = `25N-${location}-${month.replace(/\s+/g, "-")}-financial-packet.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
