import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(`${getBackendUrl()}/api/integrity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    if (!response.body) {
      return NextResponse.json({ error: "Backend integrity stream unavailable" }, { status: 502 });
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
      { error: error instanceof Error ? error.message : "Integrity proxy failed" },
      { status: 500 },
    );
  }
}
