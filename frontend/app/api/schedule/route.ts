import { NextResponse } from "next/server";

import { getBackendUrl } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(`${getBackendUrl()}/api/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
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
      { error: error instanceof Error ? error.message : "Schedule proxy failed" },
      { status: 500 },
    );
  }
}
