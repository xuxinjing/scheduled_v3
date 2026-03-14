"use client";

import { Bell, LoaderCircle, Menu, Mic, Send, UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ReasoningStream } from "@/components/reasoning-stream";
import { SchedulePreview } from "@/components/schedule-preview";
import { VoiceInput } from "@/components/voice-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage, ChatResponse, ReasoningEvent, ScheduleRun, WeekConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

type RestaurantSnapshot = {
  restaurant_config?: {
    name?: string;
    email_config?: {
      default_recipient?: string;
    };
  };
  week_config?: WeekConfig;
};

type ViewMode = "landing" | "chat";

function messageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildConversationSummary(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role === "assistant" ? "Assistant" : "Chef"}: ${message.content}`)
    .join("\n");
}

function TopControls() {
  return (
    <div className="flex items-center justify-between gap-3 px-6 pt-8 md:px-0 md:pt-6">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[#23345d] transition hover:bg-white/80 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-7 w-7" strokeWidth={1.8} />
      </button>

      <div className="hidden flex-1 md:block" />

      <div className="flex min-w-0 flex-1 items-center justify-center md:flex-none">
        <div className="flex h-[58px] min-w-0 max-w-[460px] items-center gap-3 rounded-[20px] border border-[var(--tenant-border-color)] bg-white px-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <span className="truncate text-[15px] font-semibold text-[#334155] sm:text-[17px]">
            Acquerello Kitchen Ops
          </span>
          <svg width="18" height="11" viewBox="0 0 18 11" fill="none" className="shrink-0">
            <path d="M1 1.5L9 9.5L17 1.5" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="hidden h-11 w-11 items-center justify-center rounded-full text-[#334155] transition hover:bg-white/80 md:inline-flex"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" strokeWidth={1.8} />
        </button>
        <div className="relative flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#ded9d2] text-[#9a9387]">
          <UserCircle2 className="h-11 w-11" strokeWidth={1.4} />
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
        </div>
      </div>
    </div>
  );
}

function LandingView({
  draft,
  onDraftChange,
  onSend,
  onStartVoice,
  disabled,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStartVoice: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col justify-center pb-[30px]">
      <TopControls />

      <div className="mx-auto mt-[11vh] flex w-full max-w-[940px] flex-col items-center px-6 md:mt-[14vh]">
        <div className="text-center">
          <p className="text-[18px] font-semibold text-[#2563eb] md:text-[22px]">Acquerello Scheduled</p>
          <h1 className="mt-4 text-[42px] font-semibold leading-[1.06] tracking-[-0.04em] text-[#101828] md:text-[72px]">
            Ready to generate kitchen schedule?
          </h1>
        </div>

        <div className="content-panel mt-10 flex w-full max-w-[860px] flex-col rounded-[26px] p-6 md:mt-12 md:min-h-[350px] md:p-7">
          <Textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="tell me what is different this week"
            className="min-h-[188px] resize-none border-0 bg-transparent px-1 py-1 text-[18px] text-[#111827] shadow-none ring-0 placeholder:text-[#c7cdd7] focus:border-0 focus:ring-0 md:min-h-[220px] md:text-[22px]"
          />

          <div className="mt-6 flex items-center justify-end gap-4">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onStartVoice}
              disabled={disabled}
              className="h-[78px] w-[78px] rounded-full border-[#dbe2ec] bg-[#dde3ee] text-[#0f172a] shadow-[0_8px_18px_rgba(15,23,42,0.12)] hover:bg-[#d6dde8]"
            >
              <Mic className="h-8 w-8" strokeWidth={1.8} />
            </Button>
            <Button
              type="button"
              onClick={onSend}
              disabled={disabled || !draft.trim()}
              className="h-[78px] min-w-[172px] rounded-full border-[#6b7280] bg-[#6b7280] px-8 text-[18px] font-medium text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] hover:border-[#525964] hover:bg-[#525964]"
            >
              {disabled ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Send
            </Button>
          </div>
        </div>

        <p className="mt-10 max-w-[700px] text-center text-[15px] leading-8 text-[#667085]">
          Speak naturally about time off, service level changes, station coverage, or training goals. The assistant
          will translate it into a clean schedule draft before generation.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[88%] rounded-[22px] px-4 py-3 text-[15px] leading-7 shadow-[0_6px_18px_rgba(15,23,42,0.05)] md:max-w-[78%]",
          isAssistant ? "bg-white text-[#0f172a]" : "bg-[#2563eb] text-white",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

export function ChatUI() {
  const [view, setView] = useState<ViewMode>("landing");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [weekConfig, setWeekConfig] = useState<WeekConfig | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRun | null>(null);
  const [reasoningEvents, setReasoningEvents] = useState<ReasoningEvent[]>([]);
  const [confirmationReady, setConfirmationReady] = useState(false);
  const [pendingReply, setPendingReply] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState(false);
  const [voiceAutoStart, setVoiceAutoStart] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [error, setError] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [restaurantSnapshot, setRestaurantSnapshot] = useState<RestaurantSnapshot | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetch("/api/restaurant", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: RestaurantSnapshot) => {
        setRestaurantSnapshot(payload);
        setEmailRecipient(payload.restaurant_config?.email_config?.default_recipient ?? "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!messagesEndRef.current) {
      return;
    }
    messagesEndRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, transcriptPreview, pendingReply]);

  const canGenerate = useMemo(() => Boolean(weekConfig) && !pendingReply && !pendingSchedule, [pendingReply, pendingSchedule, weekConfig]);

  async function requestAssistantReply(nextMessages: ChatMessage[]) {
    setPendingReply(true);
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json()) as ChatResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Chat request failed");
      }
      setWeekConfig(payload.weekConfig);
      setConfirmationReady(payload.confirmationReady);
      setMessages((current) => [
        ...current,
        {
          id: messageId("assistant"),
          role: "assistant",
          content: payload.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Chat request failed");
    } finally {
      setPendingReply(false);
    }
  }

  async function submitUserMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }
    setDraft("");
    setTranscriptPreview("");
    setView("chat");
    const userMessage: ChatMessage = {
      id: messageId("user"),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    await requestAssistantReply(nextMessages);
  }

  async function generateSchedule() {
    if (!weekConfig) {
      return;
    }
    setPendingSchedule(true);
    setSchedule(null);
    setReasoningEvents([]);
    setError("");
    setEmailStatus("");

    try {
      const response = await fetch("/api/schedule/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_config: weekConfig,
          restaurant_config: restaurantSnapshot?.restaurant_config,
          conversation_messages: messages,
          week_constraints_md: buildConversationSummary(messages),
          run_integrity_check: true,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({ error: "Schedule stream failed" }))) as { error?: string };
        throw new Error(payload.error || "Schedule stream failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .find((line) => line.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!dataLine) {
            continue;
          }
          const event = JSON.parse(dataLine) as ReasoningEvent;
          if (event.type === "complete" && event.content) {
            const completed = event.content as ScheduleRun;
            setSchedule(completed);
            setEmailRecipient((current) => current || completed.email_recipient || "");
          } else if (event.type !== "done") {
            setReasoningEvents((current) => [...current, event]);
          }
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Schedule generation failed");
    } finally {
      setPendingSchedule(false);
    }
  }

  async function sendEmail() {
    if (!schedule?.schedule_id || !emailRecipient.trim()) {
      return;
    }
    setEmailStatus("Sending...");
    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_id: schedule.schedule_id,
          recipient_email: emailRecipient.trim(),
        }),
      });
      const payload = (await response.json()) as { error?: string; recipient_email?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Email delivery failed");
      }
      setEmailStatus(`Sent to ${payload.recipient_email ?? emailRecipient.trim()}`);
    } catch (caughtError) {
      setEmailStatus(caughtError instanceof Error ? caughtError.message : "Email delivery failed");
    }
  }

  function startVoiceFlow() {
    setError("");
    setView("chat");
    setVoiceAutoStart(true);
  }

  return (
    <div className="min-h-full">
      {view === "landing" ? (
        <LandingView
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void submitUserMessage(draft)}
          onStartVoice={startVoiceFlow}
          disabled={pendingReply}
        />
      ) : (
        <div className="flex min-h-full flex-col pb-8">
          <TopControls />

          <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-4 pt-6 md:px-0 md:pt-8">
            <div className="content-panel flex flex-1 min-h-[440px] flex-col rounded-[26px]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--tenant-border-color)] px-5 py-4 md:px-6">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Acquerello Scheduled</p>
                  <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">Kitchen scheduling chat</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={confirmationReady ? "success" : "muted"}>
                    {confirmationReady ? "Ready to generate" : "Drafting"}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 md:px-6">
                {messages.length === 0 && !transcriptPreview ? (
                  <div className="rounded-[22px] border border-dashed border-[var(--tenant-border-color)] bg-[#fbfbfd] px-5 py-8 text-[15px] leading-7 text-[#667085]">
                    Start by typing or speaking what changed this week. The assistant will confirm the operational
                    constraints before generation.
                  </div>
                ) : null}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {transcriptPreview ? (
                  <div className="flex justify-end">
                    <div className="max-w-[88%] rounded-[22px] border border-dashed border-[#93c5fd] bg-[#eff6ff] px-4 py-3 text-[15px] leading-7 text-[#1d4ed8] md:max-w-[78%]">
                      {transcriptPreview}
                    </div>
                  </div>
                ) : null}

                {pendingReply ? (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-3 rounded-[22px] bg-white px-4 py-3 text-[15px] text-[#475467] shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
                      <LoaderCircle className="h-4 w-4 animate-spin text-[#2563eb]" />
                      Aligning the weekly constraints...
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-[var(--tenant-border-color)] px-5 py-4 md:px-6">
                <div className="rounded-[24px] border border-[var(--tenant-border-color)] bg-[#fbfbfd] p-3">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="tell me what is different this week"
                    className="min-h-[112px] resize-none border-0 bg-transparent px-2 py-2 text-[16px] shadow-none ring-0 placeholder:text-[#98a2b3] focus:border-0 focus:ring-0"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <VoiceInput
                      autoStart={voiceAutoStart}
                      onRecordingStateChange={({ isRecording, isTranscribing }) => {
                        if (!isRecording && !isTranscribing) {
                          setVoiceAutoStart(false);
                        }
                      }}
                      onTranscriptPreview={setTranscriptPreview}
                      onError={setError}
                      onTranscript={async (text) => {
                        setVoiceAutoStart(false);
                        await submitUserMessage(text);
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => void submitUserMessage(draft)}
                      disabled={pendingReply || !draft.trim()}
                      className="h-[62px] min-w-[148px] rounded-full px-6 text-[17px] shadow-[0_12px_24px_rgba(37,99,235,0.22)]"
                    >
                      {pendingReply ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-[20px] border border-[#fecaca] bg-[#fff1f2] px-5 py-4 text-[14px] text-[#b42318]">
                {error}
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-5">
                <div className="content-panel rounded-[24px] p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Generate</p>
                      <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">Run this week</h3>
                      <p className="mt-2 text-[15px] leading-7 text-[#667085]">
                        Once the draft looks right, run the integrity check and deterministic scheduler.
                      </p>
                    </div>
                    <Badge variant={weekConfig ? "success" : "muted"}>{weekConfig ? "Draft ready" : "Waiting"}</Badge>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button type="button" size="lg" disabled={!canGenerate} onClick={() => void generateSchedule()}>
                      {pendingSchedule ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
                      Generate schedule
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="secondary"
                      onClick={() => {
                        setView("landing");
                        setDraft("");
                        setMessages([]);
                        setTranscriptPreview("");
                        setWeekConfig(restaurantSnapshot?.week_config ?? null);
                        setSchedule(null);
                        setReasoningEvents([]);
                        setConfirmationReady(false);
                        setError("");
                        setEmailStatus("");
                      }}
                    >
                      Start over
                    </Button>
                  </div>
                </div>

                <ReasoningStream events={reasoningEvents} running={pendingSchedule} />
              </div>

              <div className="space-y-5">
                {schedule ? (
                  <>
                    <SchedulePreview schedule={schedule} weekConfig={weekConfig} />
                    <div className="content-panel rounded-[24px] p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Deliver</p>
                          <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">Email workbook</h3>
                        </div>
                        <Badge variant={schedule.email_sent_at ? "success" : "muted"}>
                          {schedule.email_sent_at ? "Sent" : "Not sent"}
                        </Badge>
                      </div>

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Input
                          value={emailRecipient}
                          onChange={(event) => setEmailRecipient(event.target.value)}
                          placeholder="chef@acquerello.com"
                          className="h-12 rounded-2xl"
                        />
                        <Button type="button" size="lg" onClick={() => void sendEmail()} disabled={!emailRecipient.trim()}>
                          Send email
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3">
                        {schedule.excel_url ? (
                          <a
                            href={`/api/history/${schedule.schedule_id}/artifacts/schedule_output.xlsx`}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--tenant-border-color)] bg-white px-4 text-sm font-medium text-[#111827] transition hover:bg-[#f8fafc]"
                          >
                            Download workbook
                          </a>
                        ) : null}
                        <a
                          href={`/history/${schedule.schedule_id}`}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--tenant-border-color)] bg-white px-4 text-sm font-medium text-[#111827] transition hover:bg-[#f8fafc]"
                        >
                          Open run detail
                        </a>
                      </div>

                      {emailStatus ? <p className="mt-4 text-sm text-[#667085]">{emailStatus}</p> : null}
                    </div>
                  </>
                ) : (
                  <div className="content-panel rounded-[24px] p-6">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Preview</p>
                    <h3 className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-[#111827]">Schedule output</h3>
                    <p className="mt-3 text-[15px] leading-7 text-[#667085]">
                      The weekly pivot preview, validation result, and delivery actions will appear here after the run
                      completes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
