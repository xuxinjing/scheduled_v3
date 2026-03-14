"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  Menu,
  Mic,
  Send,
  UserCircle2,
} from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";

import { ReasoningStream } from "@/components/reasoning-stream";
import { SchedulePreview } from "@/components/schedule-preview";
import { VoiceInput } from "@/components/voice-input";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage, ChatResponse, ReasoningEvent, ScheduleRun, WeekConfig } from "@/lib/types";

type WorkflowState = "idle" | "listening" | "processing" | "confirming" | "revising" | "generating" | "done";
type ViewState = "landing" | "chat";

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
  const [view, setView] = useState<ViewState>("landing");
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage(
      "assistant",
      "Tell me what is different this week. I’ll translate it into the machine schedule config and confirm it back to you.",
    ),
  ]);
  const [landingInput, setLandingInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [state, setState] = useState<WorkflowState>("idle");
  const [draftWeekConfig, setDraftWeekConfig] = useState<WeekConfig | null>(null);
  const [reasoningEvents, setReasoningEvents] = useState<ReasoningEvent[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRun | null>(null);
  const [error, setError] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("chef@example.com");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const landingInputRef = useRef<HTMLTextAreaElement | null>(null);
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
    setChatInput("");

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

  async function startFromLanding() {
    const text = landingInput.trim();
    if (!text) {
      return;
    }
    setView("chat");
    await sendMessage(text);
    setLandingInput("");
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-7">
        <button className="flex h-11 w-11 items-center justify-center text-slate-700">
          <Menu className="h-8 w-8" strokeWidth={1.75} />
        </button>
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.08)]">
          <span className="truncate text-lg font-medium text-slate-700">Acquerello Kitchen</span>
          <ChevronDown className="h-5 w-5 text-slate-700" />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex h-10 w-10 items-center justify-center text-slate-600">
            <Bell className="h-7 w-7" strokeWidth={1.75} />
          </button>
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <UserCircle2 className="h-10 w-10" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {view === "landing" ? (
        <div className="px-6 pb-10 pt-8">
          <div className="mx-auto flex min-h-[calc(100vh-140px)] flex-col justify-center">
            <div className="text-center">
              <p className="text-3xl font-semibold text-[hsl(var(--primary))]">Acquerello Scheduled</p>
              <h1 className="mx-auto mt-6 max-w-[14ch] text-[52px] font-semibold leading-[1.02] tracking-[-0.04em] text-slate-900">
                Ready to generate kitchen schedule?
              </h1>
            </div>

            <div className="mt-10 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
              <Textarea
                ref={landingInputRef}
                value={landingInput}
                onChange={(event) => setLandingInput(event.target.value)}
                placeholder="tell me what is different this week"
                className="min-h-[220px] resize-none border-0 bg-transparent px-0 py-0 text-2xl text-slate-900 shadow-none focus:border-0 focus:ring-0 placeholder:text-slate-300"
              />
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => landingInputRef.current?.focus()}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-[#dfe4ec] text-slate-800 shadow-[0_3px_10px_rgba(15,23,42,0.12)]"
                >
                  <Mic className="h-9 w-9" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  disabled={!landingInput.trim()}
                  onClick={() => void startFromLanding()}
                  className="flex h-20 min-w-[156px] items-center justify-center rounded-full bg-slate-500 px-8 text-[2rem] font-medium text-white shadow-[0_4px_16px_rgba(15,23,42,0.22)] transition disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-8">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Kitchen schedule chat</p>
                  <p className="mt-1 text-sm text-slate-500">Tell the assistant what changed, confirm it, then generate.</p>
                </div>
                <Badge variant={stateMeta.variant}>{stateMeta.text}</Badge>
              </div>
            </div>

            <div className="max-h-[380px] space-y-3 overflow-y-auto px-4 py-4">
              {bootLoading ? (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading restaurant defaults...
                </div>
              ) : null}

              {deferredMessages.map((message) => (
                <div key={message.id} className={message.role === "assistant" ? "max-w-[92%]" : "ml-auto max-w-[92%]"}>
                  <div
                    className={
                      message.role === "assistant"
                        ? "rounded-[1.4rem] rounded-tl-md bg-slate-100 px-4 py-3 text-base leading-7 text-slate-900"
                        : "rounded-[1.4rem] rounded-tr-md bg-[hsl(var(--primary))] px-4 py-3 text-base leading-7 text-white"
                    }
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <Input
                  value={chatInput}
                  disabled={state === "processing" || state === "generating"}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage(chatInput);
                    }
                  }}
                  placeholder="tell me what is different this week"
                  className="h-14 rounded-full px-5 text-base"
                />
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dfe4ec] text-slate-800"
                >
                  <Mic className="h-6 w-6" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  disabled={!chatInput.trim() || state === "processing" || state === "generating"}
                  onClick={() => void sendMessage(chatInput)}
                  className="flex h-14 min-w-[110px] items-center justify-center rounded-full bg-slate-500 px-5 text-xl font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {state === "confirming" ? (
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
                <Button onClick={() => void runSchedule()} className="h-12 w-full rounded-full text-base">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm and generate
                </Button>
                <Button variant="secondary" onClick={() => setState("revising")} className="h-12 w-full rounded-full text-base">
                  Revise
                </Button>
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-3 rounded-[1.5rem] border border-[hsl(var(--danger))]/20 bg-[hsl(var(--danger))]/8 px-4 py-3 text-sm text-[hsl(var(--foreground))]">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[hsl(var(--danger))]" />
                <span>{error}</span>
              </div>
            ) : null}

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

            {reasoningEvents.length > 0 || state === "generating" ? (
              <ReasoningStream events={reasoningEvents} running={state === "generating"} />
            ) : null}

            {schedule ? (
              <>
                <SchedulePreview schedule={schedule} weekConfig={draftWeekConfig} />
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-3">
                    <Input
                      value={recipientEmail}
                      onChange={(event) => setRecipientEmail(event.target.value)}
                      type="email"
                      placeholder="chef@restaurant.com"
                      className="h-12 rounded-full px-5"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button disabled={sendingEmail} onClick={() => void sendScheduleEmail()} className="h-12 flex-1 rounded-full text-base">
                        {sendingEmail ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send to email
                      </Button>
                      <a
                        className={buttonVariants({ variant: "secondary", className: "h-12 flex-1 rounded-full text-base" })}
                        href={`/api/history/${schedule.schedule_id}/artifacts/schedule_output.xlsx`}
                      >
                        Download Excel
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="muted">{schedule.schedule_id.slice(0, 8)}</Badge>
                      {schedule.email_sent_at ? <Badge variant="success">Sent</Badge> : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
