"use client";

import {
  ArrowUp,
  ChevronRight,
  Image as ImageIcon,
  LoaderCircle,
  Menu,
  Mic,
  Paintbrush,
  PenLine,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
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

type ConversationItem = {
  id: string;
  title: string;
  preview: string;
  date: string;
  created_at: string;
  selected_week: string;
};

const suggestions = [
  {
    icon: Paintbrush,
    title: "Create schedule",
    subtitle: "for this week",
    color: "#10a37f",
  },
  {
    icon: PenLine,
    title: "Update constraints",
    subtitle: "time off & changes",
    color: "#10a37f",
  },
  {
    icon: Sparkles,
    title: "Help me plan",
    subtitle: "training & coverage",
    color: "#10a37f",
  },
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
  conversations,
  onSelectConversation,
  onDeleteConversation,
}: {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  conversations: ConversationItem[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-[80%] max-w-[300px] flex-col bg-[var(--chatgpt-sidebar-bg)] pb-4 pt-[env(safe-area-inset-top,0px)] shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] font-medium text-[var(--chatgpt-text)] transition-colors active:bg-[var(--chatgpt-hover)]"
          >
            <Plus className="h-5 w-5" strokeWidth={1.8} />
            New chat
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--chatgpt-text-secondary)] transition-colors active:bg-[var(--chatgpt-hover)]"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        {/* Recent label */}
        <p className="mt-4 px-4 text-[12px] font-semibold text-[var(--chatgpt-text-secondary)] uppercase tracking-wide">
          Recent
        </p>

        {/* Conversations */}
        <div className="mt-1 flex-1 overflow-y-auto px-2">
          <div className="space-y-0.5">
            {conversations.length === 0 && (
              <p className="px-3 py-4 text-[13px] text-[var(--chatgpt-text-secondary)]">No conversations yet</p>
            )}
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--chatgpt-hover)]"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    onSelectConversation(conversation.id);
                    onClose();
                  }}
                >
                  <p className="truncate text-[14px] font-medium text-[var(--chatgpt-text)]">{conversation.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--chatgpt-text-secondary)]">
                    {conversation.date ? `${conversation.date} · ` : ""}{conversation.preview}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conversation.id);
                  }}
                  className="ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[var(--chatgpt-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  aria-label="Delete conversation"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-[var(--chatgpt-border)] px-4 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chatgpt-green)] text-white text-[13px] font-semibold">
              A
            </div>
            <div>
              <p className="text-[13px] font-medium text-[var(--chatgpt-text)]">Acquerello</p>
              <p className="text-[11px] text-[var(--chatgpt-text-secondary)]">Scheduled</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── ChatGPT-style top bar ────────────────────────────────────── */
function TopBar({
  onOpenMenu,
  title,
  rightSlot,
}: {
  onOpenMenu: () => void;
  title?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 pb-2 pt-[max(env(safe-area-inset-top,8px),8px)] md:px-4 md:pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--chatgpt-text)] transition-colors hover:bg-[var(--chatgpt-hover)] md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-6 w-6" strokeWidth={1.5} />
        </button>
        <h1 className="text-[18px] font-semibold text-[var(--chatgpt-text)]">
          {title || "ChatGPT"}
        </h1>
      </div>
      <div className="flex items-center gap-1">
        {rightSlot}
      </div>
    </div>
  );
}

/* ─── ChatGPT Input Bar ──────────────────────────────────────── */
function ChatInputBar({
  draft,
  onDraftChange,
  onSend,
  onStartVoice,
  onAttach,
  disabled,
  placeholder,
  voiceAutoStart,
  onRecordingStateChange,
  onTranscriptPreview,
  onError,
  onTranscript,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStartVoice: () => void;
  onAttach?: () => void;
  disabled: boolean;
  placeholder?: string;
  voiceAutoStart?: boolean;
  onRecordingStateChange?: (state: { isRecording: boolean; isTranscribing: boolean }) => void;
  onTranscriptPreview?: (text: string) => void;
  onError?: (message: string) => void;
  onTranscript?: (text: string) => Promise<void>;
}) {
  return (
    <div className="chatgpt-input-container flex items-end gap-2">
      {/* Attach button */}
      <button
        type="button"
        onClick={onAttach}
        className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--chatgpt-text-secondary)] transition-colors hover:bg-[var(--chatgpt-hover)]"
        aria-label="Attach"
      >
        <Plus className="h-5 w-5" strokeWidth={1.8} />
      </button>

      {/* Text input */}
      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (draft.trim() && !disabled) onSend();
          }
        }}
        placeholder={placeholder || "Message"}
        rows={1}
        className="max-h-[120px] min-h-[36px] w-full flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-relaxed text-[var(--chatgpt-text)] outline-none placeholder:text-[var(--chatgpt-text-secondary)]"
      />

      {/* Mic or Send button */}
      {draft.trim() ? (
        <button
          type="button"
          onClick={onSend}
          disabled={disabled}
          className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--chatgpt-text)] text-white transition-all hover:opacity-80 disabled:opacity-40"
          aria-label="Send"
        >
          {disabled ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartVoice}
          disabled={disabled}
          className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--chatgpt-text)] text-white transition-all hover:opacity-80 disabled:opacity-40"
          aria-label="Voice input"
        >
          <Mic className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/* ─── Landing ─────────────────────────────────────────────────── */
function LandingView({
  draft,
  onDraftChange,
  onSend,
  onStartVoice,
  onSuggestionClick,
  disabled,
  onOpenMenu,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStartVoice: () => void;
  onSuggestionClick: (text: string) => void;
  disabled: boolean;
  onOpenMenu: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <TopBar onOpenMenu={onOpenMenu} />

      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col items-center justify-center px-4 pb-6">
        {/* ChatGPT logo/title */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--chatgpt-border)]">
            <Sparkles className="h-6 w-6 text-[var(--chatgpt-text)]" strokeWidth={1.5} />
          </div>
          <h1 className="text-[22px] font-semibold text-[var(--chatgpt-text)]">
            What can I help with?
          </h1>
        </div>

        {/* Suggestion chips — horizontal scroll on mobile */}
        <div className="mb-8 flex w-full gap-3 overflow-x-auto pb-2 px-1 snap-x">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={suggestion.title}
                type="button"
                onClick={() => onSuggestionClick(`${suggestion.title} ${suggestion.subtitle}`)}
                className="chatgpt-suggestion flex flex-col gap-1 snap-start flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[var(--chatgpt-green)]" strokeWidth={1.8} />
                  <span className="text-[14px] font-medium text-[var(--chatgpt-text)]">{suggestion.title}</span>
                </div>
                <span className="text-[13px] text-[var(--chatgpt-text-secondary)]">{suggestion.subtitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom input */}
      <div className="sticky bottom-0 w-full bg-white px-3 pb-[max(env(safe-area-inset-bottom,8px),8px)] pt-2 md:px-0">
        <div className="mx-auto max-w-[680px]">
          <ChatInputBar
            draft={draft}
            onDraftChange={onDraftChange}
            onSend={onSend}
            onStartVoice={onStartVoice}
            disabled={disabled}
            placeholder="Message"
          />
          <p className="mt-2 text-center text-[12px] text-[var(--chatgpt-text-secondary)]">
            AI can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Voice capture — ChatGPT style ───────────────────────────── */
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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0d0d]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top,12px),12px)] pb-2">
        <h2 className="text-[16px] font-semibold text-white/90">ChatGPT Voice</h2>
        <div className="flex-1" />
      </div>

      {/* Center — Voice orb */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <VoiceInput
          variant="fullscreen"
          autoStart={autoStart}
          onTranscript={onTranscript}
          onRecordingStateChange={onRecordingStateChange}
          onTranscriptPreview={onTranscriptPreview}
          onError={onError}
        />

        {/* Live transcript */}
        {transcriptPreview && (
          <div className="mt-8 max-w-[400px] rounded-2xl bg-white/10 px-5 py-4 text-center">
            <p className="text-[16px] leading-relaxed text-white/90">{transcriptPreview}</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-4 px-4 pb-[max(env(safe-area-inset-bottom,20px),20px)] pt-4">
        {/* Thinking chip */}
        <div className="thinking-chip active">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Think...</span>
          <X className="h-3 w-3 ml-1 opacity-60" />
        </div>

        <div className="flex-1" />

        {/* Mic icon */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
          aria-label="Microphone"
        >
          <Mic className="h-5 w-5" strokeWidth={1.8} />
        </button>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Close voice"
        >
          <X className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

/* ─── Message bubble — ChatGPT style ─────────────────────────── */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex w-full", isAssistant ? "justify-start" : "justify-end")}>
      <div className="flex gap-3 max-w-full">
        {isAssistant && (
          <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--chatgpt-green)] text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        )}
        <div
          className={cn(
            "text-[15px] leading-relaxed",
            isAssistant
              ? "chatgpt-message-assistant text-[var(--chatgpt-text)]"
              : "chatgpt-message-user text-[var(--chatgpt-text)]",
          )}
        >
          {message.content}
        </div>
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
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function fetchConversations() {
    void fetch("/api/conversations", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ConversationItem[]) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => undefined);
  }

  useEffect(() => {
    void fetch("/api/restaurant", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((payload: RestaurantSnapshot | undefined) => {
        if (!payload) return;
        setRestaurantSnapshot(payload);
        setEmailRecipient(payload.restaurant_config?.email_config?.default_recipient ?? "");
      })
      .catch(() => undefined);
    fetchConversations();
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
      fetchConversations();
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
          let event: ReasoningEvent;
          try {
            event = JSON.parse(dataLine) as ReasoningEvent;
          } catch {
            continue;
          }
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

  async function selectConversation(id: string) {
    try {
      const response = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
      if (!response.ok) return;
      const conv = (await response.json()) as {
        id: string;
        selected_week: string;
        messages: Array<{ role: string; content: string }>;
      };
      setMessages(
        conv.messages.map((m) => ({
          id: messageId(m.role),
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: new Date().toISOString(),
        })),
      );
      setView("chat");
    } catch {
      // ignore
    }
  }

  async function deleteConversation(id: string) {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      fetchConversations();
    } catch {
      // ignore
    }
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
    <div className="min-h-full bg-white">
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onNewChat={resetAll}
        conversations={conversations}
        onSelectConversation={(id) => void selectConversation(id)}
        onDeleteConversation={(id) => void deleteConversation(id)}
      />

      {view === "landing" ? (
        <LandingView
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void submitUserMessage(draft)}
          onStartVoice={startVoiceFlow}
          onSuggestionClick={(text) => void submitUserMessage(text)}
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
        /* ─── Chat view — ChatGPT style ───────────────────── */
        <div className="flex min-h-full flex-col bg-white pb-[max(env(safe-area-inset-bottom,8px),8px)]">
          <TopBar
            onOpenMenu={() => setMobileMenuOpen(true)}
            title="ChatGPT"
            rightSlot={
              confirmationReady ? (
                <Badge variant="success">Ready</Badge>
              ) : undefined
            }
          />

          <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 pt-2 md:pt-4">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto pb-6">
              <div className="flex flex-col gap-4">
                {messages.length === 0 && !transcriptPreview && (
                  <div className="text-center py-12 text-[var(--chatgpt-text-secondary)] text-[15px]">
                    Start a conversation about this week&rsquo;s schedule changes.
                  </div>
                )}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {transcriptPreview && (
                  <div className="flex justify-end">
                    <div className="chatgpt-message-user border border-dashed border-[var(--chatgpt-green)]/30 text-[var(--chatgpt-text-secondary)]">
                      {transcriptPreview}
                    </div>
                  </div>
                )}

                {pendingReply && (
                  <div className="flex gap-3">
                    <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--chatgpt-green)] text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="chatgpt-message-assistant">
                      <div className="inline-flex items-center gap-2 text-[var(--chatgpt-text-secondary)]">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-600">
                    {error}
                  </div>
                )}

                {/* Generate action card */}
                {weekConfig && (
                  <div className="rounded-2xl border border-[var(--chatgpt-border)] bg-[var(--chatgpt-sidebar-bg)] p-5">
                    <h3 className="text-[16px] font-semibold text-[var(--chatgpt-text)]">Generate schedule</h3>
                    <p className="mt-1 text-[14px] text-[var(--chatgpt-text-secondary)]">
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

                    <div className="rounded-2xl border border-[var(--chatgpt-border)] bg-[var(--chatgpt-sidebar-bg)] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[16px] font-semibold text-[var(--chatgpt-text)]">Email workbook</h3>
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
                            className="inline-flex h-9 items-center rounded-lg bg-[var(--chatgpt-hover)] px-3.5 text-[13px] font-medium text-[var(--chatgpt-text)] transition-colors hover:bg-[#ddd]"
                          >
                            Download workbook
                          </a>
                        )}
                        <a
                          href={`/history/${schedule.schedule_id}`}
                          className="inline-flex h-9 items-center rounded-lg bg-[var(--chatgpt-hover)] px-3.5 text-[13px] font-medium text-[var(--chatgpt-text)] transition-colors hover:bg-[#ddd]"
                        >
                          View details
                        </a>
                      </div>

                      {emailStatus && (
                        <p className="mt-3 text-[13px] text-[var(--chatgpt-text-secondary)]">{emailStatus}</p>
                      )}
                    </div>
                  </>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Sticky input bar */}
            <div className="sticky bottom-0 mx-auto w-full max-w-[720px] bg-white pb-1 pt-3">
              <ChatInputBar
                draft={draft}
                onDraftChange={setDraft}
                onSend={() => void submitUserMessage(draft)}
                onStartVoice={startVoiceFlow}
                disabled={pendingReply}
                placeholder="Message"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
