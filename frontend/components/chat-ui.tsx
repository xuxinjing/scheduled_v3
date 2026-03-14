"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle, Send, Sparkles } from "lucide-react";
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
  const payloadLine = raw.split("\n").find((line) => line.startsWith("data:"));
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

function stateLabel(state: WorkflowState) {
  if (state === "listening") return { text: "Listening", variant: "default" as const };
  if (state === "processing") return { text: "Interpreting", variant: "warning" as const };
  if (state === "confirming") return { text: "Ready to confirm", variant: "success" as const };
  if (state === "revising") return { text: "Revision mode", variant: "muted" as const };
  if (state === "generating") return { text: "Generating", variant: "warning" as const };
  if (state === "done") return { text: "Schedule ready", variant: "success" as const };
  return { text: "Waiting", variant: "muted" as const };
}

export function ChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage(
      "assistant",
      "Tell me the week naturally. Mention service levels, days off, training, and any operational notes that matter.",
    ),
  ]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<WorkflowState>("idle");
  const [draftWeekConfig, setDraftWeekConfig] = useState<WeekConfig | null>(null);
  const [reasoningEvents, setReasoningEvents] = useState<ReasoningEvent[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRun | null>(null);
  const [error, setError] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("chef@example.com");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const deferredMessages = useDeferredValue(messages);
  const stateMeta = stateLabel(state);

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
      headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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

  async function sendScheduleEmail() {
    if (!schedule) {
      return;
    }
    setSendingEmail(true);
    const response = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    <div className="space-y-4 pb-24">
      <Card>
        <CardHeader className="border-b border-[hsl(var(--border))]">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>This week</CardTitle>
                <CardDescription>
                  Speak or type the chef notes, confirm the interpretation, then send the schedule.
                </CardDescription>
              </div>
              <Badge variant={stateMeta.variant}>{stateMeta.text}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1">1. Capture notes</span>
              <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1">2. Confirm summary</span>
              <span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-1">3. Generate and send</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {bootLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/65 px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading restaurant defaults...
            </div>
          )}

          <VoiceInput
            disabled={state === "processing" || state === "generating"}
            onRecordingStateChange={({ isRecording, isTranscribing }) => {
              if (isRecording) {
                setState("listening");
              } else if (isTranscribing) {
                setState("processing");
              } else {
                setState((current) => (current === "listening" ? "idle" : current));
              }
            }}
            onTranscript={async (text) => {
              await sendMessage(text);
            }}
          />

          <div className="rounded-xl border border-[hsl(var(--border))] bg-white">
            <div className="max-h-[340px] space-y-3 overflow-y-auto p-4">
              {deferredMessages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "assistant" ? "max-w-[92%]" : "ml-auto max-w-[92%]"}
                >
                  <div
                    className={
                      message.role === "assistant"
                        ? "rounded-2xl rounded-tl-md bg-[hsl(var(--secondary))] px-4 py-3 text-sm leading-6 text-[hsl(var(--foreground))]"
                        : "rounded-2xl rounded-tr-md bg-[hsl(var(--primary))] px-4 py-3 text-sm leading-6 text-white"
                    }
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[hsl(var(--border))] p-4">
              <div className="flex flex-col gap-3">
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
                  placeholder="Type a note or correction"
                />
                <Button
                  type="button"
                  disabled={!input.trim() || state === "processing" || state === "generating"}
                  onClick={() => void sendMessage(input)}
                  className="w-full sm:w-auto"
                >
                  {state === "processing" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send note
                </Button>
              </div>
            </div>
          </div>

          {draftWeekConfig && (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/55 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">Current machine draft</p>
              </div>
              <pre className="scrollbar-thin overflow-x-auto rounded-xl bg-white p-4 text-xs leading-6 text-[hsl(var(--foreground))]">
                {JSON.stringify(draftWeekConfig, null, 2)}
              </pre>
            </div>
          )}

          {state === "confirming" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => void runSchedule()} className="flex-1 sm:flex-none">
                <CheckCircle2 className="h-4 w-4" />
                Confirm and generate
              </Button>
              <Button variant="secondary" onClick={() => setState("revising")} className="flex-1 sm:flex-none">
                Revise notes
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--danger))]/20 bg-[hsl(var(--danger))]/8 px-4 py-3 text-sm text-[hsl(var(--foreground))]">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-[hsl(var(--danger))]" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <ReasoningStream events={reasoningEvents} running={state === "generating"} />

      {schedule ? (
        <>
          <SchedulePreview schedule={schedule} weekConfig={draftWeekConfig} />
          <Card className="fixed bottom-0 left-0 right-0 z-30 rounded-none border-x-0 border-b-0 sm:static sm:rounded-2xl sm:border">
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  type="email"
                  placeholder="chef@restaurant.com"
                />
                <Button disabled={sendingEmail} onClick={() => void sendScheduleEmail()} className="sm:w-auto">
                  {sendingEmail ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/history/${schedule.schedule_id}/artifacts/schedule_output.xlsx`}>
                  Download Excel
                </a>
                <a className={buttonVariants({ variant: "ghost", size: "sm" })} href={`/history/${schedule.schedule_id}`}>
                  View history
                </a>
                <Badge variant="muted">{schedule.schedule_id.slice(0, 8)}</Badge>
                {schedule.email_sent_at ? <Badge variant="success">Sent</Badge> : null}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              The weekly pivot schedule will appear here once generation completes.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
