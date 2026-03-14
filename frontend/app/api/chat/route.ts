import { NextResponse } from "next/server";

import { generateSchedulingReply } from "@/lib/ai";
import { getBackendUrl } from "@/lib/env";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    if (!body.messages?.length) {
      return NextResponse.json({ error: "messages are required" }, { status: 400 });
    }

    let restaurantSnapshot:
      | {
          restaurant_config?: {
            name?: string;
            employees?: Array<{
              name: string;
              role: string;
              preferred_stations?: string[];
              training_on?: string[];
              capabilities?: Record<string, string>;
            }>;
          };
          week_config?: unknown;
        }
      | undefined;
    try {
      const response = await fetch(`${getBackendUrl()}/api/restaurant`, { cache: "no-store" });
      if (response.ok) {
        restaurantSnapshot = (await response.json()) as typeof restaurantSnapshot;
      }
    } catch {
      restaurantSnapshot = undefined;
    }

    const payload = await generateSchedulingReply(body.messages, {
      restaurantConfig: restaurantSnapshot?.restaurant_config,
      baselineWeekConfig: restaurantSnapshot?.week_config,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 500 },
    );
  }
}
