import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/env";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const endpoint = id ? `${getBackendUrl()}/api/schedule/${id}` : `${getBackendUrl()}/api/schedule`;
    const response = await fetch(endpoint, { cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "History fetch failed" },
      { status: 500 },
    );
  }
}
