import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/env";

export async function GET() {
  try {
    const response = await fetch(`${getBackendUrl()}/api/conversations`, {
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}
