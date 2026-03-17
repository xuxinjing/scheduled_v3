"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

type Message = { role: "user" | "assistant"; content: string; streaming?: boolean };
type ChatMode = "idle" | "voice" | "text";
type HistoryItem = { id: number; title: string; preview: string; date: string };

const mockHistory: HistoryItem[] = [
  { id: 1, title: "Week of 03/16 schedule", preview: "Jorge has Sunday off...", date: "Today" },
  { id: 2, title: "Week of 03/09 schedule", preview: "Updated Maria's shifts...", date: "Yesterday" },
  { id: 3, title: "Week of 03/02 schedule", preview: "Holiday coverage plan", date: "Mar 2" },
  { id: 4, title: "Staff availability check", preview: "Who can cover Friday?", date: "Feb 28" },
  { id: 5, title: "Week of 02/23 schedule", preview: "Full crew except Tuesday", date: "Feb 23" },
];

/* ── Render markdown-lite: **bold** + paragraph breaks ─────────── */
function renderContent(text: string) {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, pi) => (
    <p key={pi} style={{ margin: 0, marginBottom: pi < paragraphs.length - 1 ? 12 : 0 }}>
      {para.split(/(\*\*[^*]+\*\*)/).map((chunk, ci) =>
        chunk.startsWith("**") && chunk.endsWith("**") ? (
          <strong key={ci} style={{ fontWeight: 600 }}>{chunk.slice(2, -2)}</strong>
        ) : (
          chunk
        )
      )}
    </p>
  ));
}

/* ── SVG icons ─────────────────────────────────────────────────── */
function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ChevronDownTitleIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="#2D2D2D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 2 }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function GhostIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* Dome head + body with two bumps at hem */}
      <path d="M12 3C8.13 3 5 6.13 5 10v8l2.5-2 2.5 2 2.5-2 2.5 2 2.5-2V10c0-3.87-3.13-7-7-7z"/>
      {/* Eyes */}
      <circle cx="9.5" cy="10.5" r="0.8" fill="#444" stroke="none"/>
      <circle cx="14.5" cy="10.5" r="0.8" fill="#444" stroke="none"/>
    </svg>
  );
}

function PlusWhiteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlusGrayIcon({ color = "#9B9B9B", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MicIcon({ color = "#9B9B9B" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}

function WaveformIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ChevronDownScrollIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function MicOutlineIcon({ white }: { white?: boolean }) {
  const c = white ? "#FFFFFF" : "#8A7F74";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}
function SoundwaveIcon() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
      <div className="sw-bar sw-bar-1" />
      <div className="sw-bar sw-bar-2" />
      <div className="sw-bar sw-bar-3" />
      <div className="sw-bar sw-bar-4" />
      <div className="sw-bar sw-bar-5" />
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C96A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* ── Message sub-components ────────────────────────────────────── */
function UserBubble({ content }: { content: string }) {
  return (
    <div
      style={{
        alignSelf: "flex-end",
        backgroundColor: "#FFFFFF",
        borderRadius: "18px 18px 4px 18px",
        padding: "12px 16px",
        maxWidth: "80%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
        fontSize: 15,
        color: "#1A1A1A",
        lineHeight: 1.5,
      }}
    >
      {content}
    </div>
  );
}

/* AssistantMessage — renders streamed content with per-token CSS fade-in */
function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  // Track what was shown on the previous render to extract the newly arrived text
  const prevContentRef = React.useRef("");
  const prevContent = prevContentRef.current;
  prevContentRef.current = content;

  // During streaming, split into already-shown base and newly-arrived token
  const newText = (streaming && content.length > prevContent.length)
    ? content.slice(prevContent.length)
    : "";
  const baseText = newText ? prevContent : content;

  const showDot = streaming && content === "";

  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "100%",
        fontSize: 15,
        lineHeight: 1.7,
        color: "#2D2D2D",
        fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
        padding: "0 4px",
      }}
    >
      {showDot
        ? <span className="cl-thinking-dot" />
        : <>
            {renderContent(baseText)}
            {newText && <span key={content.length} className="chat-stream-fadein">{newText}</span>}
            {streaming && <span className="cl-cursor" />}
          </>
      }
    </div>
  );
}

/* ── Shared button style ───────────────────────────────────────── */
type CSSProps = React.CSSProperties;

const BTN: CSSProps = {
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: "none",
  padding: 0,
};

const NAV_BTN: CSSProps = {
  ...BTN,
  width: 40,
  height: 40,
  borderRadius: "50%",
  boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
};

/* ── Main component ────────────────────────────────────────────── */
export function ClaudeMobileUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showFab, setShowFab] = useState(false);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<ChatMode>("idle");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [emptyStatePhase, setEmptyStatePhase] = useState<"visible" | "fading" | "gone">("visible");

  const scrollRef          = useRef<HTMLDivElement>(null);
  const endRef             = useRef<HTMLDivElement>(null);
  const textareaRef        = useRef<HTMLTextAreaElement>(null);
  const containerRef       = useRef<HTMLDivElement>(null);
  const vapiRef            = useRef<Vapi | null>(null);
  const inputGroupRef      = useRef<HTMLDivElement>(null);
  const isChatExpandedRef  = useRef(false);

  // true when any conversation is active OR messages exist (persists after voice call-end)
  const isConversation = mode !== "idle" || messages.length > 0;
  // true only when the text input bar is visually expanded (NOT during voice mode)
  const isActiveInput  = isChatExpanded;

  const [keyboardHeight, setKeyboardHeight]   = useState(0);

  const [weekOpen, setWeekOpen]               = useState(false);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(1); // default: next Monday
  const [ddCoords, setDdCoords]               = useState({ top: 0, left: 0 });

  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);
  const weekTriggerRef = useRef<HTMLDivElement>(null);
  const rafRef         = useRef<number | undefined>(undefined);

  // 8 weeks: current week's Monday + 7 future weeks
  const weekOptions: string[] = (() => {
    const weeks: string[] = [];
    const today = new Date();
    const day = today.getDay(); // 0=Sun …
    const daysToCurrentMonday = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + daysToCurrentMonday);
    for (let i = 0; i < 8; i++) {
      const monday = new Date(currentMonday);
      monday.setDate(currentMonday.getDate() + i * 7);
      const mm   = String(monday.getMonth() + 1).padStart(2, "0");
      const dd   = String(monday.getDate()).padStart(2, "0");
      const yyyy = monday.getFullYear();
      weeks.push(`${mm}/${dd}/${yyyy}`);
    }
    return weeks;
  })();

  function toggleWeek() {
    if (!weekOpen && weekTriggerRef.current) {
      const rect = weekTriggerRef.current.getBoundingClientRect();
      setDdCoords({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
    }
    setWeekOpen((v: boolean) => !v);
  }

  /* iOS Safari visual viewport — push input bar above keyboard.
     rAF-debounced so keyboard animation frames don't trigger React re-renders;
     CSS var --kb drives the input group's bottom property (layout-based lift). */
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const handleResize = () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const offset = window.innerHeight - viewport.height - viewport.offsetTop;
        const next = offset > 0 ? offset : 0;
        document.documentElement.style.setProperty("--kb", `${next}px`);
        setKeyboardHeight(next);
      });
    };
    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleResize);
    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleResize);
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* scroll helpers */
  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(dist < 100);   // auto-scroll threshold
    setShowFab(dist > 200);      // FAB threshold
  }, []);

  /* auto-scroll on new content or keyboard open/close */
  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages, pending, isAtBottom, scrollToBottom, keyboardHeight]);

  /* focus textarea when transitioning to active input */
  useEffect(() => {
    if (isActiveInput) textareaRef.current?.focus();
  }, [isActiveInput]);

  /* Fade out empty state then unmount — one-way per session */
  const enterConversation = useCallback(() => {
    if (emptyStatePhase !== "visible") return;
    setEmptyStatePhase("fading");
    setTimeout(() => setEmptyStatePhase("gone"), 220);
  }, [emptyStatePhase]);

  /* textarea auto-resize — also updates containerRef max-height to exact content */
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
    if (containerRef.current) {
      containerRef.current.style.maxHeight = `${ta.scrollHeight + 80}px`;
    }
  }, []);

  /* Focus: expand container to exact scrollHeight + 80px (action row overhead) */
  const handleInputFocus = useCallback(() => {
    setIsChatExpanded(true);
    const scrollH = textareaRef.current?.scrollHeight ?? 48;
    if (containerRef.current) {
      containerRef.current.style.maxHeight = `${scrollH + 80}px`;
    }
  }, []);


  /* Vapi instance + all event listeners — created once on mount */
  useEffect(() => {
    const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
    vapiRef.current = vapi;

    vapi.on("speech-start", () => { setIsAgentSpeaking(true); });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vapi.on("message", (msg: any) => {
      if (msg.type === "transcript") {
        if (msg.role === "assistant") {
          // Update the CURRENT assistant bubble in real-time as words stream in
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last?.streaming) {
              return [...prev.slice(0, -1), { ...last, content: msg.transcript }];
            }
            return [...prev, { role: "assistant", content: msg.transcript, streaming: true }];
          });
        }
        if (msg.role === "user" && msg.transcriptType === "final") {
          setMessages(prev => [...prev, { role: "user", content: msg.transcript }]);
        }
      }
    });

    vapi.on("speech-end", () => {
      setIsAgentSpeaking(false);
      // Mark last assistant message as no longer streaming
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
        return prev;
      });
    });

    vapi.on("call-end", () => { setMode("idle"); });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vapi.on("error", (e: any) => { console.error("Vapi error:", e); });

    return () => { vapi.removeAllListeners(); };
  }, []);

  /* Keep ref in sync so outside-tap handler reads latest value without re-registering */
  useEffect(() => { isChatExpandedRef.current = isChatExpanded; }, [isChatExpanded]);

  /* Tap outside input group → collapse input, messages stay intact */
  useEffect(() => {
    const handleOutsideTap = (e: MouseEvent | TouchEvent) => {
      if (
        inputGroupRef.current &&
        !inputGroupRef.current.contains(e.target as Node) &&
        isChatExpandedRef.current
      ) {
        setIsChatExpanded(false);
        textareaRef.current?.blur();
        if (containerRef.current) {
          containerRef.current.style.maxHeight = "48px";
        }
      }
    };
    document.addEventListener("touchstart", handleOutsideTap);
    document.addEventListener("mousedown", handleOutsideTap);
    return () => {
      document.removeEventListener("touchstart", handleOutsideTap);
      document.removeEventListener("mousedown", handleOutsideTap);
    };
  }, []);

  /* Voice: start call */
  const handleVoiceStart = async () => {
    enterConversation();
    setMode("voice");
    // Pass assistant ID as string — Vapi.start(string) routes to the given assistant
    await vapiRef.current?.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID);
  };

  /* Voice: end call — set mode immediately for instant UI response */
  const handleVoiceStop = () => {
    vapiRef.current?.stop();
    setMode("idle");
  };

  /* Text: send message with streaming response */
  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || pending) return;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (mode === "idle") {
      enterConversation();
      setMode("text");
    }
    setIsChatExpanded(true);

    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsAtBottom(true);
    setPending(true);

    // Add empty streaming assistant placeholder
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      // TODO: replace with real backend endpoint
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg], selectedWeek: weekOptions[selectedWeekIdx] }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") { streamDone = true; break; }
            const text = data.replace(/\\n/g, "\n");
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.streaming) {
                return [...prev.slice(0, -1), { ...last, content: last.content + text }];
              }
              return prev;
            });
          }
          if (streamDone) break;
        }
      }
    } catch {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { ...last, content: "Something went wrong.", streaming: false }];
        }
        return [...prev, { role: "assistant", content: "Something went wrong." }];
      });
    } finally {
      // Mark streaming done
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
        return prev;
      });
      setPending(false);
    }
  }

  function resetConversation() {
    vapiRef.current?.stop();
    setMessages([]);
    setInputValue("");
    setPending(false);
    setIsChatExpanded(false);
    setMode("idle");
    setIsAgentSpeaking(false);
    setEmptyStatePhase("visible");
    setShowFab(false);
  }

  return (
    <>
      <style>{`
        .claude-textarea::placeholder { color: #AAAAAA; }
        .claude-pill-input::placeholder { color: #9B9B9B; }

        /* ── Thinking dot (breathe animation while LLM is responding) ── */
        @keyframes cl-breathe {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%       { transform: scale(1.5); opacity: 1; }
        }
        .cl-thinking-dot {
          display: block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #C96A4A;
          margin: 4px 0;
          animation: cl-breathe 1.2s ease-in-out infinite;
        }

        /* ── Streaming cursor — solid 2px bar ── */
        @keyframes cl-cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .cl-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: #2D2D2D;
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: cl-cursor-blink 0.8s step-end infinite;
        }

        /* ── Message list inner — flex column, centred, generous gaps ── */
        .cl-msgs-inner {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px 20px;
          max-width: 680px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }

        /* ── Exchange separator between conversation turns ── */
        .cl-ex-sep {
          height: 1px;
          background: #EAE5DC;
          margin: 8px 0;
          flex-shrink: 0;
        }

        /* ── Scroll-to-bottom FAB entrance ── */
        @keyframes cl-fab-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .cl-fab {
          animation: cl-fab-in 0.2s ease forwards;
        }

        /* ── Empty state: fade-out on conversation start ── */
        .cl-empty {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .cl-empty.fading {
          opacity: 0;
          transform: translateY(-8px);
        }

        /* ── Overscroll bounce fix: prevent rubber-band gap ── */
        html, body {
          overscroll-behavior-y: none;
        }
        body {
          background-color: #F9F6F1;
        }

        /* ── Navbar backstop: extends cream above viewport for iOS bounce ── */
        .cl-nav-bg {
          position: fixed;
          top: -100px;
          left: 0;
          width: 100%;
          height: calc(60px + env(safe-area-inset-top) + 100px);
          background: #F9F6F1;
          z-index: 99;
        }

        /* ── Navbar: always fixed, cream fills status bar zone ── */
        .cl-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: #F9F6F1;
          padding-top: calc(env(safe-area-inset-top) + 12px);
        }

        /* ── Content offset: 60px bar + safe-area-inset-top ── */
        .cl-empty { padding-top: calc(60px + env(safe-area-inset-top)); }
        .cl-msgs  { padding-top: calc(60px + env(safe-area-inset-top)); }

        /* ── Input bar outer — block child of .cl-ig ── */
        .cl-iw {
          /* positioned by .cl-ig parent */
        }
        /* ── Input bar inner — only max-height and border-radius animate ── */
        .cl-ic {
          background: #FFFFFF;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border-radius: 999px;
          max-height: 48px;
          transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                      border-radius 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                      box-shadow 0.15s ease,
                      transform 0.15s ease;
          will-change: max-height, border-radius;
        }
        /* Idle pill hover/press — only when not expanded */
        .cl-iw:not(.cl-iw-on) .cl-ic:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          transform: translateY(-1px);
        }
        .cl-iw:not(.cl-iw-on) .cl-ic:active {
          transform: translateY(0px);
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .cl-ir {
          display: flex;
          align-items: center;
          padding: 4px 8px 4px 16px;
          gap: 8px;
          opacity: 1;
          transition: opacity 0.15s ease;
        }
        .cl-ie {
          /* No max-height transition — parent .cl-ic controls height */
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
          transform: translateY(4px);
          /* Only opacity + transform — compositor-safe only */
          transition: opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s;
        }
        .cl-ia {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          opacity: 0;
          transform: translateY(4px);
          /* Delay 0.12s — fades in only after container finishes expanding */
          transition: opacity 0.2s ease 0.12s, transform 0.2s ease 0.12s;
        }

        /* ── Input bar: active / expanded — inner elements only ── */
        .cl-iw-on .cl-ic {
          border-radius: 20px;
          border-top: 1px solid #E5E0D8;
          /* max-height set via containerRef JS — no static value here */
        }
        .cl-iw-on .cl-ir {
          /* Fade out first (0.15s), then snap height away (no jitter: not transitioning) */
          opacity: 0;
          height: 0;
          padding: 0;
          overflow: hidden;
          pointer-events: none;
          transition: opacity 0.15s ease,
                      height 0s linear 0.15s,
                      padding 0s linear 0.15s;
        }
        .cl-iw-on .cl-ie {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
          padding: 14px 16px;
        }
        .cl-iw-on .cl-ia {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── Week dropdown ── */
        .wk-dd {
          width: 220px;
          background: #FFFFFF;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
          overflow: hidden;
          z-index: 400;
          opacity: 0;
          transform: translateX(-50%) translateY(-6px);
          pointer-events: none;
          transition: opacity 0.2s ease-out, transform 0.2s ease-out;
        }
        .wk-dd.open {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
          pointer-events: auto;
        }
        .wk-row {
          padding: 12px 20px;
          font-size: 14px;
          color: #2D2D2D;
          font-family: system-ui, -apple-system, 'Inter', sans-serif;
          cursor: pointer;
          transition: background 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-sizing: border-box;
        }
        .wk-row:hover { background: #F4EFE6; }
        .wk-row.sel {
          background: #F4EFE6;
          font-weight: 600;
          color: #1A1A1A;
        }

        /* ── Desktop: full-width web app layout ── */
        @media (min-width: 768px) {
          body { background-color: #F9F6F1; }

          /* Full-width — no phone frame, no box-shadow */
          .cl-col {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            position: relative !important;
          }

          /* Navbar backstop: full width */
          .cl-nav-bg {
            left: 0 !important;
            transform: none !important;
            width: 100% !important;
          }

          /* Navbar: full width, 24px side padding */
          .cl-nav {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            transform: none !important;
            width: 100% !important;
            padding-top: calc(10px + env(safe-area-inset-top)) !important;
            padding-right: 24px !important;
            padding-bottom: 10px !important;
            padding-left: 24px !important;
            z-index: 100 !important;
            background-color: #F9F6F1 !important;
            box-sizing: border-box !important;
          }

          .cl-empty { padding-top: calc(60px + env(safe-area-inset-top)) !important; }
          .cl-msgs  { padding-top: calc(60px + env(safe-area-inset-top)) !important; }

          /* Message content: centered readable column */
          .cl-msgs-inner {
            max-width: 680px;
            margin: 0 auto;
            padding: 0 24px;
            width: 100%;
            box-sizing: border-box;
          }

          /* Input group: desktop fine-tuning only */
          .cl-ig {
            bottom: calc(16px + var(--kb, 0px)) !important;
            width: min(680px, calc(100vw - 48px)) !important;
          }

          /* Sidebar: absolute within the full-width column */
          .cl-sb {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            height: 100% !important;
          }
          .cl-sb-bd {
            position: absolute !important;
            inset: 0 !important;
          }
        }

        /* ── History sidebar ── */
        .cl-sb {
          position: fixed;
          top: 0;
          left: 0;
          width: 300px;
          height: 100vh;
          background: #FFFFFF;
          z-index: 300;
          box-shadow: 4px 0 24px rgba(0,0,0,0.10);
          border-radius: 0 24px 24px 0;
          display: flex;
          flex-direction: column;
          padding-top: calc(env(safe-area-inset-top) + 16px);
          transform: translateX(-100%);
          /* visibility hidden on close hides the box-shadow bleed at x=0 */
          visibility: hidden;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      visibility 0s linear 0.3s;
        }
        .cl-sb.open {
          transform: translateX(0);
          visibility: visible;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      visibility 0s linear 0s;
        }
        .cl-sb-bd {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(2px);
          z-index: 200;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .cl-sb-bd.open {
          opacity: 1;
          pointer-events: auto;
        }
        .cl-sb-row {
          padding: 10px 20px;
          cursor: pointer;
          border-radius: 12px;
          margin: 2px 8px;
          transition: background 0.15s ease;
        }
        .cl-sb-row:hover { background: #F4EFE6; }
        .cl-sb-row.active {
          background: #F4EFE6;
          border-left: 3px solid #C96A4A;
          padding-left: 17px;
        }

        /* ── Input group: single fixed container, grows upward — never overlaps ── */
        .cl-ig {
          position: fixed;
          /* keyboard lift via bottom (layout property) — not transform */
          bottom: calc(env(safe-area-inset-bottom) + 12px + var(--kb, 0px));
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 648px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 0; /* spacing handled by .cl-vb-wrap margin-top so it can be zeroed on hide */
        }

        /* ── Voice button ── */
        .cl-vb {
          background: #E8E0D4;
          border-radius: 999px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          cursor: pointer;
          border: none;
          width: 100%;
          box-sizing: border-box;
          transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.15s ease,
                      opacity 0.2s ease;
        }
        .cl-vb:hover { background: #DDD5C8; transform: scale(0.98); }
        .cl-vb.active { background: #2D2D2D; }
        .cl-vb.active:hover { background: #3A3A3A; }

        /* Hide voice button when chat input is expanded */
        .cl-vb-wrap {
          /* margin-top replaces the parent gap so it can be zeroed when collapsed */
          margin-top: 10px;
          max-height: 70px; /* tall enough for button; collapses to 0 on hide */
          overflow: hidden;
          opacity: 1;
          pointer-events: auto;
          /* 0.1s delay on fade-in: space + opacity open after input finishes collapsing */
          transition: opacity 0.2s ease 0.1s, max-height 0.25s ease 0.1s, margin-top 0.25s ease 0.1s;
        }
        .cl-vb-wrap.hidden {
          opacity: 0;
          max-height: 0;    /* removes button from flex flow — no ghost space */
          margin-top: 0;    /* zeroes the gap too */
          pointer-events: none;
          /* No delay on hide — collapses immediately when input expands */
          transition: opacity 0.15s ease, max-height 0.2s ease, margin-top 0.2s ease;
        }

        /* Coral pulse dot */
        @keyframes cl-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        .cl-vb-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #C96A4A;
          animation: cl-pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        /* 5-bar soundwave (voice active state) */
        @keyframes soundwave {
          0%, 100% { height: 4px; }
          50%       { height: 18px; }
        }
        .sw-bar {
          width: 3px;
          border-radius: 2px;
          background: #FFFFFF;
          animation: soundwave 0.9s ease-in-out infinite;
          flex-shrink: 0;
        }
        .sw-bar-1 { animation-delay: 0s; }
        .sw-bar-2 { animation-delay: 0.1s; }
        .sw-bar-3 { animation-delay: 0.2s; }
        .sw-bar-4 { animation-delay: 0.1s; }
        .sw-bar-5 { animation-delay: 0s; }
      `}</style>

      {/* ── Sidebar backdrop ──────────────────────────────────────── */}
      <div className={`cl-sb-bd${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ── History sidebar ───────────────────────────────────────── */}
      <div className={`cl-sb${sidebarOpen ? " open" : ""}`}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px 20px", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", fontFamily: "system-ui, -apple-system, 'Inter', sans-serif" }}>scheduled.ai</span>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "#F0EDE8", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#555" }}
          >✕</button>
        </div>

        {/* New chat button */}
        <button
          type="button"
          onClick={() => { resetConversation(); setActiveHistoryId(null); setSidebarOpen(false); }}
          style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 16px", padding: "10px 16px", background: "#F4EFE6", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#2D2D2D", fontFamily: "system-ui, -apple-system, 'Inter', sans-serif", width: "calc(100% - 32px)", boxSizing: "border-box" }}
        >
          <PencilIcon />
          New chat
        </button>

        {/* Section label */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "#AAAAAA", letterSpacing: "0.08em", textTransform: "uppercase", padding: "20px 20px 8px 20px", flexShrink: 0 }}>Recent</div>

        {/* History list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {mockHistory.map((item) => (
            <div
              key={item.id}
              className={`cl-sb-row${activeHistoryId === item.id ? " active" : ""}`}
              onClick={() => { setActiveHistoryId(item.id); setSidebarOpen(false); }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A1A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.preview}</div>
              <div style={{ fontSize: 11, color: "#BBBBBB", marginTop: 2 }}>{item.date}</div>
            </div>
          ))}
        </div>

        {/* Settings row */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #F0EDE8", fontSize: 14, color: "#888", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, cursor: "pointer", fontFamily: "system-ui, -apple-system, 'Inter', sans-serif" }}>
          <GearIcon />
          Settings
        </div>
      </div>

      {/* ── Week dropdown backdrop ─────────────────────────────── */}
      {weekOpen && (
        <div
          onClick={() => setWeekOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 199, background: "transparent" }}
        />
      )}

      {/* ── Week dropdown ──────────────────────────────────────── */}
      <div
        className={`wk-dd${weekOpen ? " open" : ""}`}
        style={{ position: "fixed", top: ddCoords.top, left: ddCoords.left }}
      >
        {weekOptions.map((week, idx) => (
          <div
            key={week}
            className={`wk-row${idx === selectedWeekIdx ? " sel" : ""}`}
            onClick={() => { setSelectedWeekIdx(idx); setWeekOpen(false); }}
          >
            <span>{"Week of " + week}</span>
            {idx === selectedWeekIdx && (
              <span style={{ color: "#C96A4A", fontSize: 8, lineHeight: 1 }}>●</span>
            )}
          </div>
        ))}
      </div>

      <div
        className="cl-col"
        style={{
          width: "100vw",
          height: isConversation ? "calc(var(--vh, 1vh) * 100)" : undefined,
          minHeight: "calc(var(--vh, 1vh) * 100)",
          backgroundColor: "#F9F6F1",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
          boxSizing: "border-box",
          overflow: isConversation ? "hidden" : undefined,
          margin: 0,
          padding: 0,
        }}
      >
        {/* ── Navbar bounce backstop ── */}
        <div className="cl-nav-bg" />

        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav
          className="cl-nav"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: 10,
            backgroundColor: "#F9F6F1",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              backgroundColor: "#EFEFEF", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }}
          >
            <HamburgerIcon />
          </button>

          <div
            ref={weekTriggerRef}
            onClick={toggleWeek}
            style={{ textAlign: "center", flex: 1, margin: "0 8px", cursor: "pointer", userSelect: "none" }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              Select Week<ChevronDownTitleIcon />
            </div>
            <div style={{ fontSize: 12, color: "#999", fontWeight: 400, marginTop: 1 }}>{weekOptions[selectedWeekIdx]}</div>
          </div>

          {isConversation ? (
            <button
              type="button"
              aria-label="New conversation"
              onClick={resetConversation}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                backgroundColor: "#C96A4A", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              }}
            >
              <PlusWhiteIcon />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Incognito"
              style={{
                width: 40, height: 40, borderRadius: "50%",
                backgroundColor: "#EFEFEF", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: "#444", boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              }}
            >
              <GhostIcon />
            </button>
          )}
        </nav>

        {/* ── Empty state — fades out on first interaction, never remounts ── */}
        {emptyStatePhase !== "gone" && (
          <div
            className={`cl-empty${emptyStatePhase === "fading" ? " fading" : ""}`}
            style={{
              height: typeof window !== "undefined"
                ? Math.max(200, window.innerHeight - keyboardHeight - 60 - 140) /* 60=navbar, 140=input group */
                : undefined,
              flex: typeof window !== "undefined" ? undefined : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: 24,
              paddingRight: 24,
              boxSizing: "border-box",
            }}
          >
            <h1
              style={{
                fontFamily: "'Tiempos Text', Georgia, 'Times New Roman', serif",
                fontSize: 28,
                fontWeight: 600,
                color: "#2D2D2D",
                textAlign: "center",
                lineHeight: 1.15,
                width: "100%",
                marginTop: 0,
                marginBottom: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Hi chef, ready to create schedule?
            </h1>
          </div>
        )}

        {/* ── Message list ─────────────────────────────────────── */}
        {isConversation && (
          <div
            ref={scrollRef}
            className="cl-msgs"
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: "auto",
              paddingBottom: 185 + keyboardHeight, /* chat bar ~60px + gap 10px + voice bar ~56px + 12px bottom + extra */
            }}
          >
            <div className="cl-msgs-inner">
              {messages.map((msg: Message, i: number) => {
                // Divider between exchanges: before every user message except the first
                const isNewExchange = msg.role === "user" && i > 0;
                return (
                  <React.Fragment key={i}>
                    {isNewExchange && <div className="cl-ex-sep" />}
                    {msg.role === "user" && <UserBubble content={msg.content} />}
                    {msg.role === "assistant" && (
                      <AssistantMessage content={msg.content} streaming={msg.streaming} />
                    )}
                  </React.Fragment>
                );
              })}

              <div ref={endRef} />
            </div>
          </div>
        )}

        {/* ── Scroll-to-bottom FAB — appears when >200px from bottom ─── */}
        {isConversation && showFab && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className="cl-fab"
            style={{
              ...BTN,
              position: "fixed",
              bottom: 140,
              left: "50%",
              transform: "translateX(-50%)",
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E0D8",
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              zIndex: 20,
            }}
          >
            <ChevronDownScrollIcon />
          </button>
        )}

        {/* ── Input group: single fixed container — chat on top, voice on bottom ── */}
        <div className="cl-ig" ref={inputGroupRef}>

        {/* Chat input bar — display:none in voice to preserve typed text */}
        <div className={`cl-iw${isActiveInput ? " cl-iw-on" : ""}`} style={{ display: mode === "voice" ? "none" : undefined }}>
          <div className="cl-ic" ref={containerRef}>

            {/* Pill row — visible when idle */}
            <div className="cl-ir">
              <button type="button" aria-label="Attach" style={BTN}>
                <PlusGrayIcon size={22} />
              </button>
              <input
                className="claude-pill-input"
                type="text"
                value={inputValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") void sendMessage(); }}
                placeholder="Chat with scheduled.ai"
                style={{
                  flex: 1, border: "none", background: "transparent", outline: "none",
                  fontSize: 16, color: "#2D2D2D",
                  fontFamily: "system-ui, -apple-system, 'Inter', sans-serif", minWidth: 0,
                }}
              />
              <button type="button" aria-label="Voice input" style={BTN}>
                <MicIcon />
              </button>
              <button
                type="button" aria-label="Send" onClick={() => void sendMessage()}
                style={{ ...BTN, width: 40, height: 40, borderRadius: "50%", backgroundColor: "#C96A4A" }}
              >
                <WaveformIcon />
              </button>
            </div>

            {/* Expanded area — visible when active */}
            <div className="cl-ie">
              <textarea
                ref={textareaRef}
                className="claude-textarea"
                value={inputValue}
                rows={1}
                placeholder="Reply to scheduled.ai"
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setInputValue(e.target.value); autoResize(); }}
                onFocus={handleInputFocus}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
                }}
                style={{
                  width: "100%", border: "none", outline: "none", background: "transparent",
                  resize: "none", fontSize: 16, color: "#2D2D2D",
                  fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
                  minHeight: 48, maxHeight: 160, overflowY: "auto",
                  lineHeight: 1.5, boxSizing: "border-box", display: "block",
                }}
              />
              <div className="cl-ia">
                <button type="button" aria-label="Attach" style={BTN}>
                  <PlusGrayIcon color="#888" size={22} />
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" aria-label="Voice input" style={BTN}>
                    <MicIcon color="#888" />
                  </button>
                  <button
                    type="button" aria-label="Send" onClick={() => void sendMessage()}
                    style={{ ...BTN, width: 40, height: 40, borderRadius: "50%", backgroundColor: "#C96A4A" }}
                  >
                    <WaveformIcon />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>{/* end .cl-iw */}

        {/* Voice button — always rendered; fades when text input is active */}
        <div className={`cl-vb-wrap${isActiveInput ? " hidden" : ""}`}>
          <button
            type="button"
            className={`cl-vb${mode === "voice" ? " active" : ""}`}
            onClick={mode === "voice"
              ? () => { handleVoiceStop(); textareaRef.current?.focus(); }
              : () => void handleVoiceStart()}
          >
            {/* Left: mic icon + cross-fading label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MicOutlineIcon white={mode === "voice"} />
              {/* Idle label drives layout width; active label overlaps absolutely */}
              <span style={{ position: "relative", fontSize: 15, fontWeight: 500, fontFamily: "system-ui, -apple-system, 'Inter', sans-serif" }}>
                <span style={{
                  display: "block",
                  color: "#6B6259",
                  opacity: mode === "voice" ? 0 : 1,
                  transition: mode === "voice" ? "opacity 0.15s ease" : "opacity 0.2s ease 0.15s",
                  userSelect: "none",
                }}>
                  Talk to scheduled.ai
                </span>
                <span style={{
                  position: "absolute", top: 0, left: 0,
                  color: "#FFFFFF", whiteSpace: "nowrap",
                  opacity: mode === "voice" ? 1 : 0,
                  transition: mode === "voice" ? "opacity 0.2s ease" : "opacity 0.1s ease",
                  userSelect: "none",
                }}>
                  Listening...
                </span>
              </span>
            </div>
            {/* Right: soundwave + dot always in DOM, cross-fade via opacity */}
            <div style={{ position: "relative", width: 27, height: 20, flexShrink: 0 }}>
              <div style={{
                position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                opacity: mode === "voice" ? 1 : 0,
                transition: mode === "voice" ? "opacity 0.2s ease 0.05s" : "opacity 0.15s ease",
              }}>
                <SoundwaveIcon />
              </div>
              <div style={{
                position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                opacity: mode === "voice" ? 0 : 1,
                transition: mode === "voice" ? "opacity 0.1s ease" : "opacity 0.2s ease 0.15s",
              }}>
                <div className="cl-vb-dot" />
              </div>
            </div>
          </button>
        </div>

        </div>{/* end .cl-ig */}
      </div>
    </>
  );
}
