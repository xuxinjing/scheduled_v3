import { getBackendUrl } from "@/lib/env";

export async function POST(request: Request) {
  let backendUrl: string;
  try {
    backendUrl = getBackendUrl();
  } catch {
    return new Response(JSON.stringify({ error: "BACKEND_URL is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as {
    messages?: Array<{ role: string; content: string }>;
    selectedWeek?: string;
    conversation_id?: string;
  };

  const messages = body.messages ?? [];

  // Split messages into history + the final user message, as the backend expects
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  const message = lastUserIdx >= 0 ? messages[lastUserIdx].content : "";
  const history = messages.slice(0, lastUserIdx);

  const backendPayload = {
    message,
    history,
    selected_week: body.selectedWeek ?? "",
    conversation_id: body.conversation_id ?? null,
  };

  const backendRes = await fetch(`${backendUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(backendPayload),
  });

  if (!backendRes.ok || !backendRes.body) {
    const text = await backendRes.text().catch(() => "Backend request failed");
    return new Response(JSON.stringify({ error: text }), {
      status: backendRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pass the SSE stream straight through to the browser
  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
