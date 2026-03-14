import Anthropic from "@anthropic-ai/sdk";

import { loadSchedulingContext } from "@/lib/context-files";
import type { ChatMessage, ChatResponse } from "@/lib/types";

const WEEK_CONFIG_SCHEMA = `{
  "week_start": "YYYY-MM-DD",
  "service_levels": { "Tuesday": "mid|slow|peak" },
  "unavailable": { "Name": ["Day"] },
  "forced_days": { "Name": ["Day"] },
  "training_shadows": { "Name": { "days": ["Day"], "station": "Station" } },
  "weekly_capability_grants": { "Name": { "days": ["Day"], "station": "Station", "level": "stable|learning|emergency" } },
  "notes": ["Natural-language note"]
}`;

function extractJsonBlock(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1];
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  throw new Error("Model response did not include JSON");
}

function buildStaffRosterSummary(restaurantConfig?: {
  employees?: Array<{
    name: string;
    role: string;
    preferred_stations?: string[];
    training_on?: string[];
    capabilities?: Record<string, string>;
  }>;
}) {
  return (restaurantConfig?.employees ?? [])
    .map((employee) => {
      const stations = Object.entries(employee.capabilities ?? {})
        .map(([station, level]) => `${station}(${level})`)
        .join(", ");
      const preferred = employee.preferred_stations?.length ? ` preferred: ${employee.preferred_stations.join(", ")}` : "";
      const training = employee.training_on?.length ? ` training: ${employee.training_on.join(", ")}` : "";
      return `- ${employee.name} [${employee.role}] ${stations}${preferred}${training}`.trim();
    })
    .join("\n");
}

export async function generateSchedulingReply(
  messages: ChatMessage[],
  options?: {
    restaurantConfig?: {
      name?: string;
      employees?: Array<{
        name: string;
        role: string;
        preferred_stations?: string[];
        training_on?: string[];
        capabilities?: Record<string, string>;
      }>;
    };
    baselineWeekConfig?: unknown;
  },
): Promise<ChatResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const context = await loadSchedulingContext();
  const client = new Anthropic({ apiKey });
  const baselineWeekConfig = JSON.stringify(options?.baselineWeekConfig ?? JSON.parse(context.baselineWeekConfig), null, 2);
  const staffRosterSummary = buildStaffRosterSummary(options?.restaurantConfig);

  const system = `You are a kitchen scheduling assistant for ${options?.restaurantConfig?.name ?? "Acquerello"}.

## Your Role
Help the head chef create the weekly schedule by:
1. Understanding their natural language requirements
2. Mapping them to structured scheduling constraints
3. Confirming the full constraint set before generating

## Restaurant Knowledge
${context.kitchenState}

## Constraint Types You Can Generate
${context.constraintTypes}

## Last Week's Configuration (as baseline)
${baselineWeekConfig}

## Staff Roster
${staffRosterSummary || "Use the restaurant knowledge and prior schedule as the authoritative roster."}

## Rules
- Always infer implied constraints when they are operationally necessary.
- Always confirm before generating.
- If the chef's instructions are ambiguous, ask for clarification.
- The Kate/Chris Mids split is a standing pattern unless the chef overrides it.
- Keep the chef-facing summary concise and conversational.
- Output the final week_config as valid JSON matching the schema.
- If the chef is confirming the plan, return confirmationReady=true.

## Output Format
Return ONLY JSON with this exact shape:
{
  "reply": "chef-facing summary",
  "confirmationReady": true,
  "weekConfig": ${WEEK_CONFIG_SCHEMA}
}`;

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_CHAT_MODEL ?? "claude-haiku-4-5-20251001",
    max_tokens: 1600,
    temperature: 0.2,
    system,
    messages: messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    })),
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const parsed = JSON.parse(extractJsonBlock(text)) as ChatResponse;
  return parsed;
}
