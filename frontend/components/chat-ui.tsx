"use client";

import { AlertTriangle, LoaderCircle, Send, Sparkles } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { ReasoningStream } from "@/components/reasoning-stream";
import { SchedulePreview } from "@/components/schedule-preview";
import { VoiceInput } from "@/components/voice-input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ChatMessage, ChatResponse, ReasoningEvent, ScheduleRun, WeekConfig } from "@/lib/types";

type WorkflowState = "idle" | "listening" | "processing" | "confirming" | "revising" | "generating" | "done";

function makeMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function parseSseEvent(raw: string): ReasoningEvent | null {
  const payloadLine = raw
    .split("\n")
    .find((line) => line.startsWith("data:"));
  if (!payloadLine) {
    return null;
  }
  try {
    return JSON.parse(payloadLine.slice(5).trim()) as ReasoningEvent;
  } catch {
    return null;
  }
}

function buildWeekConstraintsMarkdown(weekConfig: WeekConfig) {
  const sections = [
    "# week_constraints.md",
    "",
    "## Week Of",
    weekConfig.week_start,
    "",
    "## Service Levels",
    ...Object.entries(weekConfig.service_levels).map(([day, level]) => `- ${day}: ${level}`),
    "",
    "## Unavailable",
    ...(Object.entries(weekConfig.unavailable).length
      ? Object.entries(weekConfig.unavailable).map(([name, days]) => `- ${name}: ${days.join(", ")}`)
      : ["- None"]),
    "",
    "## Forced Days",
    ...(Object.entries(weekConfig.forced_days).length
      ? Object.entries(weekConfig.forced_days).map(([name, days]) => `- ${name}: ${days.join(", ")}`)
      : ["- None"]),
    "",
    "## Notes",
    ...(weekConfig.notes.length ? weekConfig.notes.map((note) => `- ${note}`) : ["- None"]),
  ];
  return sections.join("\n");
}

export function ChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage(
      "assistant",
      "Tell me the week naturally. Mention service levels, days off, training, and anything operationally sharp.",
    ),
  ]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<WorkflowState>("idle");
  const [draftWeekConfig, setDraftWeekConfig] = useState<WeekConfig | null>(null);
  const [reasoningEvents, setReasoningEvents] = useState<ReasoningEvent[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRun | null>(null);
  const [error, setError] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState("chef@example.com");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const deferredMessages = useDeferredValue(messages);

  useEffect(() => {
    void fetch("/api/restaurant")
      .then((response) => response.json())
      .then((data: { restaurant_config?: { email_config?: { default_recipient?: string } } }) => {
        const email = data.restaurant_config?.email_config?.default_recipient;
        if (email) {
          setRecipientEmail(email);
        }
      })
      .finally(() => setBootLoading(false));
  }, []);

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text) {
      return;
    }

    setError("");
    setState("processing");
    const nextMessages = [...messages, makeMessage("user", text)];
    setMessages(nextMessages);
    setInput("");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: nextMessages }),
    });
    const payload = (await response.json()) as ChatResponse & { error?: string };
    if (!response.ok) {
      setError(payload.error || "Unable to interpret chef request.");
      setState("idle");
      return;
    }

    startTransition(() => {
      setMessages((current) => [...current, makeMessage("assistant", payload.reply)]);
      setDraftWeekConfig(payload.weekConfig);
      setState(payload.confirmationReady ? "confirming" : "idle");
    });
  }

  async function runSchedule() {
    if (!draftWeekConfig) {
      return;
    }
    try {
      setState("generating");
      setSchedule(null);
      setReasoningEvents([{ type: "phase", content: "Connecting to backend scheduler..." }]);
      setError("");

      const weekConstraintsMd = buildWeekConstraintsMarkdown(draftWeekConfig);
      const response = await fetch("/api/schedule/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          week_config: draftWeekConfig,
          week_constraints_md: weekConstraintsMd,
          conversation_messages: messages,
          run_integrity_check: true,
        }),
      });

      if (!response.body) {
        throw new Error("Schedule stream did not return a body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError = "";
      let completedSchedule: ScheduleRun | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        while (buffer.includes("\n\n")) {
          const chunk = buffer.slice(0, buffer.indexOf("\n\n"));
          buffer = buffer.slice(buffer.indexOf("\n\n") + 2);
          const event = parseSseEvent(chunk);
          if (!event) {
            continue;
          }
          startTransition(() => {
            setReasoningEvents((current) => [...current, event]);
          });
          if (event.type === "complete" && event.content) {
            completedSchedule = event.content as unknown as ScheduleRun;
          }
          if (event.type === "error" || event.status === "fail" || event.status === "failed") {
            streamError = typeof event.content === "string" ? event.content : "Schedule generation failed";
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }
      if (!completedSchedule) {
        throw new Error("Schedule stream completed without a final schedule payload");
      }

      startTransition(() => {
        setSchedule(completedSchedule);
        setState("done");
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Schedule generation failed");
      setState("confirming");
    }
  }

  async function sendEmailPlaceholder() {
    if (!schedule) {
      return;
    }
    setSendingEmail(true);
    const response = await fetch("/api/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schedule_id: schedule.schedule_id,
        recipient_email: recipientEmail,
      }),
    });
    const payload = (await response.json()) as { error?: string; recipient_email?: string };
    if (!response.ok) {
      setError(payload.error || "Email delivery failed.");
    } else {
      setError("");
      setSchedule((current) =>
        current
          ? {
              ...current,
              email_sent_at: new Date().toISOString(),
              email_recipient: payload.recipient_email ?? recipientEmail,
            }
          : current,
      );
    }
    setSendingEmail(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[hsl(var(--border))]/60 bg-oven-glow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Chef conversation</CardTitle>
                <CardDescription>
                  Speak or type the weekly notes. The assistant converts them into a confirmed machine config.
                </CardDescription>
              </div>
              <Badge variant={state === "done" ? "success" : state === "generating" ? "warning" : "default"}>
                {state}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {bootLoading && (
              <div className="flex items-center gap-2 rounded-[1.25rem] bg-[hsl(var(--muted))]/60 px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading restaurant defaults...
              </div>
            )}
            <div className="scrollbar-thin max-h-[420px] space-y-4 overflow-y-auto rounded-[1.75rem] border border-[hsl(var(--border))]/70 bg-white/60 p-4">
              {deferredMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-[1.5rem] px-4 py-3 ${
                    message.role === "assistant"
                      ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                      : "ml-auto bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                </div>
              ))}
            </div>

            <VoiceInput
              disabled={state === "processing" || state === "generating"}
              onRecordingStateChange={({ isRecording, isTranscribing }) => {
                if (isRecording) {
                  setState("listening");
                } else if (isTranscribing) {
                  setState("processing");
                } else if (state === "listening") {
                  setState("idle");
                }
              }}
              onTranscript={async (text) => {
                await sendMessage(text);
              }}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={input}
                disabled={state === "processing" || state === "generating"}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Type a revision or weekly note..."
              />
              <Button
                type="button"
                disabled={!input.trim() || state === "processing" || state === "generating"}
                onClick={() => void sendMessage(input)}
              >
                {state === "processing" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>

            {draftWeekConfig && (
              <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <p className="font-medium">Current week_config draft</p>
                </div>
                <pre className="overflow-x-auto rounded-[1.25rem] bg-[hsl(var(--muted))]/70 p-4 text-xs leading-6 text-[hsl(var(--foreground))]">
                  {JSON.stringify(draftWeekConfig, null, 2)}
                </pre>
              </div>
            )}

            {state === "confirming" && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void runSchedule()}>Confirm and generate</Button>
                <Button variant="secondary" onClick={() => setState("revising")}>
                  Revise
                </Button>
              </div>
            )}

            {schedule && (
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/75 p-4 sm:flex-row sm:flex-wrap">
                <Input
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  type="email"
                  className="sm:max-w-[280px]"
                  placeholder="chef@restaurant.com"
                />
                <Button disabled={sendingEmail} onClick={() => void sendEmailPlaceholder()}>
                  {sendingEmail ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Send to email
                </Button>
                <a className={buttonVariants({ variant: "secondary" })} href={`/api/history/${schedule.schedule_id}/artifacts/schedule_output.xlsx`}>
                  Download Excel
                </a>
                <a className={buttonVariants({ variant: "ghost" })} href={`/history/${schedule.schedule_id}`}>
                  Open history detail
                </a>
                <Badge variant="muted">Schedule ID {schedule.schedule_id}</Badge>
                {schedule.email_sent_at && <Badge variant="success">Sent</Badge>}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-[1.5rem] border border-[hsl(var(--danger))]/20 bg-[hsl(var(--danger))]/10 px-4 py-3 text-sm text-[hsl(var(--foreground))]">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[hsl(var(--danger))]" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <ReasoningStream events={reasoningEvents} running={state === "generating"} />
        {schedule ? (
          <SchedulePreview schedule={schedule} weekConfig={draftWeekConfig} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Preview area</CardTitle>
              <CardDescription>The pivot preview slides in here after the reasoning stream completes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-[1.5rem] border border-dashed border-[hsl(var(--border))] p-8 text-sm text-[hsl(var(--muted-foreground))]">
                Confirm a draft week_config to generate the schedule preview.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
