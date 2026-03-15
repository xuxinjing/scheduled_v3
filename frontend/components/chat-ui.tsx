"use client";

import { Bell, ChevronRight, LoaderCircle, Menu, MessageSquarePlus, Mic, Send, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

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

type ViewMode = "landing" | "voice" | "chat";

const fakeConversations = [
  { title: "Week of March 10", preview: "Chef off Tuesday, CDC back on Friday", active: true },
  { title: "Week of March 3", preview: "Private dining added Thursday", active: false },
  { title: "Week of February 24", preview: "Training shadows for garde manger", active: false },
  { title: "Week of February 17", preview: "Peak service on Friday and Saturday", active: false },
];

function messageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildConversationSummary(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role === "assistant" ? "Assistant" : "Chef"}: ${message.content}`)
    .join("\n");
}

function MobileDrawer({
  open,
  onClose,
  onNewChat,
}: {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[#111827]/56 backdrop-blur-[2px] transition-opacity md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[84%] max-w-[320px] border-r border-white/8 bg-[#202123] px-4 pb-5 pt-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.38)] transition-transform duration-300 md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.08em] text-white/92">Chats</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/72 transition hover:bg-white/8 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-left transition hover:bg-white/12"
        >
          <MessageSquarePlus className="h-5 w-5 text-[#8ab4ff]" />
          <span className="text-sm font-medium text-white">New chat</span>
        </button>

        <p className="mt-6 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">Recent</p>

        <div className="mt-3 space-y-1.5">
          {fakeConversations.map((conversation) => (
            <button
              key={conversation.title}
              type="button"
              onClick={onClose}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition",
                conversation.active ? "bg-white/10" : "hover:bg-white/6",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white/92">{conversation.title}</p>
                <p className="mt-1 truncate text-xs text-white/48">{conversation.preview}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/28" />
            </button>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
            <p className="text-sm font-medium text-white/88">Acquerello Scheduled</p>
            <p className="mt-1 text-xs text-white/46">Kitchen scheduling workspace</p>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopControls({
  onOpenMenu,
  rightSlot,
}: {
  onOpenMenu: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pl-8 pr-6 pt-12 md:px-0 md:pt-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-11 w-11 items-center justify-center bg-transparent text-[#23345d] transition md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-7 w-7" strokeWidth={1.8} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {rightSlot ?? (
          <button
            type="button"
            className="hidden h-11 w-11 items-center justify-center rounded-full text-[#334155] transition hover:bg-white/80 md:inline-flex"
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" strokeWidth={1.8} />
          </button>
        )}
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
  onOpenMenu,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStartVoice: () => void;
  disabled: boolean;
  onOpenMenu: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col justify-center pb-[30px]">
      <TopControls onOpenMenu={onOpenMenu} />

      <div className="mx-auto mt-[7vh] flex w-full max-w-[940px] flex-col items-center px-[22px] md:mt-[14vh] md:px-6">
        <div className="text-center">
          <p className="brand-serif text-[30px] leading-none text-[#2f6ae6] md:text-[68px]">Acquerello Scheduled</p>
          <h1 className="nav-title mt-6 text-[16px] leading-[1.5] text-[#101828] md:text-[34px]">
            Ready to generate kitchen schedule?
          </h1>
        </div>

        <div className="apple-panel mt-8 flex w-full max-w-[860px] flex-col rounded-[30px] px-5 pb-5 pt-5 md:mt-12 md:min-h-[350px] md:rounded-[32px] md:p-8">
          <Textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Tell me what is different this week"
            className="min-h-[150px] resize-none border-0 bg-transparent px-3 py-3 text-[17px] text-[#111827] shadow-none ring-0 placeholder:text-[#c4cbd6] focus:border-0 focus:ring-0 md:min-h-[220px] md:px-9 md:py-7 md:text-[22px]"
          />

          <div className="mt-6 flex items-center justify-end gap-4 pr-2 pb-2 md:mt-14 md:gap-8 md:pr-6 md:pb-5">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onStartVoice}
              disabled={disabled}
              className="h-[58px] w-[58px] rounded-full border-[#dbe2ec] bg-[#e8eef8] text-[#0f172a] shadow-[0_8px_18px_rgba(15,23,42,0.08)] hover:bg-[#dde6f5] md:h-[78px] md:w-[78px]"
            >
              <Mic className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.8} />
            </Button>
            <Button
              type="button"
              onClick={onSend}
              disabled={disabled || !draft.trim()}
              className="h-[58px] min-w-[132px] rounded-full border-[#636a77] bg-[#636a77] px-5 text-[16px] font-medium text-white shadow-[0_10px_18px_rgba(15,23,42,0.12)] hover:border-[#565d69] hover:bg-[#565d69] md:h-[78px] md:min-w-[172px] md:px-8 md:text-[18px]"
            >
              {disabled ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Send
            </Button>
          </div>
        </div>

        <p className="mt-7 max-w-[700px] px-4 text-center text-[14px] leading-7 text-[#6b7280]">
          Speak naturally about time off, service level changes, station coverage, or training goals.
        </p>
      </div>
    </div>
  );
}

function VoiceCaptureView({
  transcriptPreview,
  onOpenMenu,
  onClose,
  onTranscript,
  onRecordingStateChange,
  onTranscriptPreview,
  onError,
  autoStart,
}: {
  transcriptPreview: string;
  onOpenMenu: () => void;
  onClose: () => void;
  onTranscript: (text: string) => Promise<void>;
  onRecordingStateChange: (state: { isRecording: boolean; isTranscribing: boolean }) => void;
  onTranscriptPreview: (text: string) => void;
  onError: (message: string) => void;
  autoStart: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col pb-8">
      <TopControls
        onOpenMenu={onOpenMenu}
        rightSlot={
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-[#334155] transition hover:bg-white/70 md:hidden"
          >
            Close
          </button>
        }
      />

      <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col items-center justify-center px-6 pb-12">
        <VoiceInput
          variant="fullscreen"
          autoStart={autoStart}
          onTranscript={onTranscript}
          onRecordingStateChange={onRecordingStateChange}
          onTranscriptPreview={onTranscriptPreview}
          onError={onError}
        />

        <div className="apple-panel mt-10 min-h-[120px] w-full max-w-[720px] rounded-[30px] px-6 py-5 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Live transcript</p>
          <p className="mt-4 min-h-[48px] text-[20px] leading-8 text-[#111827]">
            {transcriptPreview || "Start speaking about this week’s changes..."}
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex w-full", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "text-[15px] leading-7",
          isAssistant
            ? "apple-panel w-full rounded-[30px] px-5 py-4 text-[#0f172a]"
            : "max-w-[85%] rounded-[26px] bg-[#2f6ae6] px-5 py-3.5 text-white shadow-[0_12px_28px_rgba(47,106,230,0.18)] md:max-w-[70%]",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

export function ChatUI() {
  const [view, setView] = useState<ViewMode>("landing");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const [voiceState, setVoiceState] = useState({ isRecording: false, isTranscribing: false });
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
    setTranscriptPreview("");
    setView("voice");
    setVoiceAutoStart(true);
  }

  return (
    <div className="min-h-full">
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onNewChat={() => {
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
      />
      {view === "landing" ? (
        <LandingView
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void submitUserMessage(draft)}
          onStartVoice={startVoiceFlow}
          disabled={pendingReply}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      ) : view === "voice" ? (
        <VoiceCaptureView
          transcriptPreview={transcriptPreview}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onClose={() => {
            setVoiceAutoStart(false);
            setTranscriptPreview("");
            setView("landing");
          }}
          autoStart={voiceAutoStart}
          onRecordingStateChange={(state) => {
            setVoiceState(state);
            if (!state.isRecording && !state.isTranscribing) {
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
      ) : (
        <div className="flex min-h-full flex-col pb-8">
          <TopControls onOpenMenu={() => setMobileMenuOpen(true)} />

          <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col px-4 pt-4 md:px-0 md:pt-6">
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Acquerello Scheduled</p>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">Conversation</h2>
              </div>
              <Badge variant={confirmationReady ? "success" : "muted"}>
                {confirmationReady ? "Ready to generate" : "Drafting"}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
              <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
                {messages.length === 0 && !transcriptPreview ? (
                  <div className="rounded-[28px] border border-dashed border-[var(--tenant-border-color)] bg-white px-6 py-8 text-[15px] leading-7 text-[#667085] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    Start by typing or speaking what changed this week. The assistant will confirm the operational constraints before generation.
                  </div>
                ) : null}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {transcriptPreview ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-[24px] border border-dashed border-[#93c5fd] bg-[#eff6ff] px-5 py-3.5 text-[15px] leading-7 text-[#1d4ed8] md:max-w-[70%]">
                      {transcriptPreview}
                    </div>
                  </div>
                ) : null}

                {pendingReply ? (
                  <div className="rounded-[24px] border border-[var(--tenant-border-color)] bg-white px-5 py-4 text-[15px] text-[#475467] shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                    <div className="inline-flex items-center gap-3">
                      <LoaderCircle className="h-4 w-4 animate-spin text-[#2563eb]" />
                      Aligning the weekly constraints...
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-[24px] border border-[#fecaca] bg-[#fff1f2] px-5 py-4 text-[14px] text-[#b42318]">
                    {error}
                  </div>
                ) : null}

                {weekConfig ? (
                  <div className="apple-panel rounded-[30px] px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Next step</p>
                        <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">Generate this week</h3>
                        <p className="mt-2 text-[15px] leading-7 text-[#667085]">
                          Once the plan looks right, run the integrity check and deterministic scheduler.
                        </p>
                      </div>
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
                ) : null}

                {(reasoningEvents.length > 0 || pendingSchedule) ? (
                  <ReasoningStream events={reasoningEvents} running={pendingSchedule} />
                ) : null}

                {schedule ? (
                  <>
                    <SchedulePreview schedule={schedule} weekConfig={weekConfig} />
                    <div className="apple-panel rounded-[30px] px-6 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Deliver</p>
                          <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">Email workbook</h3>
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
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 mx-auto w-full max-w-[820px] pb-2 pt-4">
              <div className="apple-panel rounded-[30px] px-4 py-4">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Tell me what is different this week"
                  className="min-h-[88px] resize-none border-0 bg-transparent px-2 py-2 text-[16px] shadow-none ring-0 placeholder:text-[#98a2b3] focus:border-0 focus:ring-0"
                />
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="flex-1">
                    <VoiceInput
                      autoStart={voiceAutoStart}
                      onRecordingStateChange={({ isRecording, isTranscribing }) => {
                        setVoiceState({ isRecording, isTranscribing });
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
                  </div>
                  <Button
                    type="button"
                    onClick={() => void submitUserMessage(draft)}
                    disabled={pendingReply || !draft.trim()}
                    className="h-[58px] min-w-[132px] rounded-full px-5 text-[16px] shadow-[0_12px_24px_rgba(37,99,235,0.20)] md:h-[62px] md:min-w-[148px] md:px-6 md:text-[17px]"
                  >
                    {pendingReply ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
