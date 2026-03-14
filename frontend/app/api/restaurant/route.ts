import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/env";

export async function GET() {
  try {
    const response = await fetch(`${getBackendUrl()}/api/restaurant`, { cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restaurant fetch failed" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(`${getBackendUrl()}/api/restaurant`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restaurant update failed" },
      { status: 500 },
    );
  }
}
