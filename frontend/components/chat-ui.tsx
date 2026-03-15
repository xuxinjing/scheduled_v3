"use client";

import { ArrowUp, ChevronRight, LoaderCircle, Menu, Mic, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { ReasoningStream } from "@/components/reasoning-stream";
import { SchedulePreview } from "@/components/schedule-preview";
import { VoiceInput } from "@/components/voice-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/* ─── Mobile drawer ───────────────────────────────────────────── */
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
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-[82%] max-w-[320px] flex-col bg-[#f5f5f7] pb-5 pt-[env(safe-area-inset-top,0px)] shadow-[4px_0_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-[17px] font-semibold text-[#1d1d1f]">Chats</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[#86868b] transition-colors active:bg-black/10"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* New chat */}
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex w-full items-center gap-3 rounded-[12px] bg-white px-3.5 py-2.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors active:bg-[#f0f0f2]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-medium text-[#1d1d1f]">New Chat</span>
          </button>
        </div>

        {/* Section label */}
        <p className="mt-5 px-5 text-[12px] font-semibold text-[#86868b]">Recent</p>

        {/* Conversations */}
        <div className="mt-2 flex-1 overflow-y-auto px-3">
          <div className="space-y-0.5">
            {fakeConversations.map((conversation) => (
              <button
                key={conversation.title}
                type="button"
                onClick={onClose}
                className={cn(
                  "flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left transition-colors",
                  conversation.active ? "bg-black/[0.06]" : "active:bg-black/[0.04]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[#1d1d1f]">{conversation.title}</p>
                  <p className="mt-0.5 truncate text-[13px] text-[#86868b]">{conversation.preview}</p>
                </div>
                <ChevronRight className="ml-2 h-4 w-4 flex-shrink-0 text-[#c7c7cc]" />
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-5">
          <div className="border-t border-black/5 pt-4">
            <p className="text-[13px] font-medium text-[#1d1d1f]">Acquerello Scheduled</p>
            <p className="text-[11px] text-[#86868b]">Kitchen scheduling workspace</p>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Top bar (mobile menu button) ────────────────────────────── */
function TopBar({
  onOpenMenu,
  rightSlot,
}: {
  onOpenMenu: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-[max(env(safe-area-inset-top,12px),12px)] md:px-0 md:pt-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#1d1d1f] transition-colors active:bg-black/5 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-6 w-6" strokeWidth={1.5} />
      </button>
      <div className="flex-1" />
      {rightSlot}
    </div>
  );
}

/* ─── Landing ─────────────────────────────────────────────────── */
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex min-h-full flex-col">
      <TopBar onOpenMenu={onOpenMenu} />

      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col items-center justify-center px-2 pb-10">
        {/* Title */}
        <div className="text-center">
          <h1 className="brand-serif text-[32px] leading-tight text-[#1d1d1f] md:text-[48px]">
            Acquerello Scheduled
          </h1>
          <p className="mt-3 text-[17px] text-[#86868b] md:text-[20px]">
            What&rsquo;s different this week?
          </p>
        </div>

        {/* Input card */}
        <div className="apple-card mt-8 w-full rounded-[20px] p-4 md:mt-10">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Chef is off Tuesday, CDC returns Friday..."
            rows={4}
            className="w-full resize-none bg-transparent px-1 py-1 text-[16px] leading-relaxed text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc] md:text-[17px]"
          />

          {/* Actions */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onStartVoice}
              disabled={disabled}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/5 active:bg-black/8 disabled:opacity-40"
              aria-label="Voice input"
            >
              <Mic className="h-5 w-5" strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={onSend}
              disabled={disabled || !draft.trim()}
              className={cn(
                "flex h-[34px] w-[34px] items-center justify-center rounded-full transition-all",
                draft.trim()
                  ? "bg-[hsl(var(--primary))] text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
                  : "bg-[#e8e8ed] text-[#c7c7cc]",
              )}
              aria-label="Send"
            >
              {disabled ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        <p className="mt-5 px-4 text-center text-[13px] leading-5 text-[#86868b]">
          Speak naturally about time off, service level changes, station coverage, or training goals.
        </p>
      </div>
    </div>
  );
}

/* ─── Voice capture ───────────────────────────────────────────── */
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
    <div className="flex min-h-full flex-col">
      <TopBar
        onOpenMenu={onOpenMenu}
        rightSlot={
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-medium text-[hsl(var(--primary))] transition-opacity active:opacity-60"
          >
            Done
          </button>
        }
      />

      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col items-center justify-center px-6 pb-16">
        <VoiceInput
          variant="fullscreen"
          autoStart={autoStart}
          onTranscript={onTranscript}
          onRecordingStateChange={onRecordingStateChange}
          onTranscriptPreview={onTranscriptPreview}
          onError={onError}
        />

        {/* Live transcript */}
        <div className="apple-card mt-8 min-h-[80px] w-full max-w-[560px] rounded-[16px] px-5 py-4 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#86868b]">Live transcript</p>
          <p className="mt-3 text-[17px] leading-7 text-[#1d1d1f]">
            {transcriptPreview || "Start speaking about this week\u2019s changes\u2026"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Message bubble ──────────────────────────────────────────── */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex w-full", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "text-[15px] leading-relaxed",
          isAssistant
            ? "apple-card w-full rounded-[16px] px-4 py-3.5 text-[#1d1d1f]"
            : "max-w-[82%] rounded-[18px] bg-[hsl(var(--primary))] px-4 py-3 text-white md:max-w-[70%]",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

/* ─── Main export ─────────────────────────────────────────────── */
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
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, transcriptPreview, pendingReply]);

  const canGenerate = useMemo(
    () => Boolean(weekConfig) && !pendingReply && !pendingSchedule,
    [pendingReply, pendingSchedule, weekConfig],
  );

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
      if (!response.ok) throw new Error(payload.error || "Chat request failed");
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
    if (!trimmed) return;
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
    if (!weekConfig) return;
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
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .find((line) => line.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!dataLine) continue;
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
    if (!schedule?.schedule_id || !emailRecipient.trim()) return;
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
      if (!response.ok) throw new Error(payload.error || "Email delivery failed");
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

  function resetAll() {
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
  }

  return (
    <div className="min-h-full">
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onNewChat={resetAll}
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
            if (!state.isRecording && !state.isTranscribing) setVoiceAutoStart(false);
          }}
          onTranscriptPreview={setTranscriptPreview}
          onError={setError}
          onTranscript={async (text) => {
            setVoiceAutoStart(false);
            await submitUserMessage(text);
          }}
        />
      ) : (
        /* ─── Chat view ────────────────────────────────────── */
        <div className="flex min-h-full flex-col pb-4">
          <TopBar onOpenMenu={() => setMobileMenuOpen(true)} />

          <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col pt-2 md:pt-4">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">Conversation</h2>
              </div>
              <Badge variant={confirmationReady ? "success" : "muted"}>
                {confirmationReady ? "Ready" : "Drafting"}
              </Badge>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto pb-6">
              <div className="flex flex-col gap-3">
                {messages.length === 0 && !transcriptPreview && (
                  <div className="rounded-[14px] border border-dashed border-[#d2d2d7] bg-white/60 px-5 py-5 text-[15px] leading-relaxed text-[#86868b]">
                    Start by typing or speaking what changed this week. The assistant will confirm the constraints before generation.
                  </div>
                )}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {transcriptPreview && (
                  <div className="flex justify-end">
                    <div className="max-w-[82%] rounded-[18px] border border-dashed border-[hsl(var(--primary))]/30 bg-[hsl(var(--accent))] px-4 py-3 text-[15px] leading-relaxed text-[hsl(var(--primary))] md:max-w-[70%]">
                      {transcriptPreview}
                    </div>
                  </div>
                )}

                {pendingReply && (
                  <div className="apple-card rounded-[14px] px-4 py-3.5 text-[15px] text-[#86868b]">
                    <div className="inline-flex items-center gap-2.5">
                      <LoaderCircle className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
                      Aligning constraints...
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-[14px] bg-[hsl(var(--danger))]/[0.08] px-4 py-3.5 text-[14px] text-[hsl(var(--danger))]">
                    {error}
                  </div>
                )}

                {/* Generate action card */}
                {weekConfig && (
                  <div className="apple-card rounded-[16px] p-5">
                    <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Generate schedule</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#86868b]">
                      Run the integrity check and deterministic scheduler.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <Button type="button" disabled={!canGenerate} onClick={() => void generateSchedule()}>
                        {pendingSchedule && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Generate
                      </Button>
                      <Button type="button" variant="secondary" onClick={resetAll}>
                        Start over
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reasoning stream */}
                {(reasoningEvents.length > 0 || pendingSchedule) && (
                  <ReasoningStream events={reasoningEvents} running={pendingSchedule} />
                )}

                {/* Schedule result + email */}
                {schedule && (
                  <>
                    <SchedulePreview schedule={schedule} weekConfig={weekConfig} />

                    <div className="apple-card rounded-[16px] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[17px] font-semibold text-[#1d1d1f]">Email workbook</h3>
                        <Badge variant={schedule.email_sent_at ? "success" : "muted"}>
                          {schedule.email_sent_at ? "Sent" : "Not sent"}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                        <Input
                          value={emailRecipient}
                          onChange={(event) => setEmailRecipient(event.target.value)}
                          placeholder="chef@acquerello.com"
                          className="flex-1"
                        />
                        <Button type="button" onClick={() => void sendEmail()} disabled={!emailRecipient.trim()}>
                          Send
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {schedule.excel_url && (
                          <a
                            href={`/api/history/${schedule.schedule_id}/artifacts/schedule_output.xlsx`}
                            className="inline-flex h-9 items-center rounded-[10px] bg-black/[0.04] px-3.5 text-[13px] font-medium text-[#1d1d1f] transition-colors hover:bg-black/[0.07]"
                          >
                            Download workbook
                          </a>
                        )}
                        <a
                          href={`/history/${schedule.schedule_id}`}
                          className="inline-flex h-9 items-center rounded-[10px] bg-black/[0.04] px-3.5 text-[13px] font-medium text-[#1d1d1f] transition-colors hover:bg-black/[0.07]"
                        >
                          View details
                        </a>
                      </div>

                      {emailStatus && (
                        <p className="mt-3 text-[13px] text-[#86868b]">{emailStatus}</p>
                      )}
                    </div>
                  </>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Sticky input bar */}
            <div className="sticky bottom-0 mx-auto w-full max-w-[720px] pb-1 pt-3">
              <div className="apple-card flex items-end gap-2.5 rounded-[20px] px-3.5 py-3">
                {/* Voice button */}
                <VoiceInput
                  autoStart={voiceAutoStart}
                  onRecordingStateChange={({ isRecording, isTranscribing }) => {
                    setVoiceState({ isRecording, isTranscribing });
                    if (!isRecording && !isTranscribing) setVoiceAutoStart(false);
                  }}
                  onTranscriptPreview={setTranscriptPreview}
                  onError={setError}
                  onTranscript={async (text) => {
                    setVoiceAutoStart(false);
                    await submitUserMessage(text);
                  }}
                />

                {/* Text input */}
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (draft.trim() && !pendingReply) void submitUserMessage(draft);
                    }
                  }}
                  placeholder="Message..."
                  rows={1}
                  className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-relaxed text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc]"
                />

                {/* Send button */}
                <button
                  type="button"
                  onClick={() => void submitUserMessage(draft)}
                  disabled={pendingReply || !draft.trim()}
                  className={cn(
                    "mb-0.5 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full transition-all",
                    draft.trim() && !pendingReply
                      ? "bg-[hsl(var(--primary))] text-white"
                      : "bg-[#e8e8ed] text-[#c7c7cc]",
                  )}
                  aria-label="Send"
                >
                  {pendingReply ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
