import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(`${getBackendUrl()}/api/schedule/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Schedule stream failed");
      return NextResponse.json(
        { error: text },
        { status: response.status },
      );
    }

    if (!response.body) {
      return NextResponse.json({ error: "Backend schedule stream unavailable" }, { status: 502 });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Schedule stream proxy failed" },
      { status: 500 },
    );
  }
}
