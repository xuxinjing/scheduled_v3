"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type HistoryItem = { id: number; title: string; preview: string; date: string };

const mockHistory: HistoryItem[] = [
  { id: 1, title: "Week of 03/16 schedule", preview: "Jorge has Sunday off...", date: "Today" },
  { id: 2, title: "Week of 03/09 schedule", preview: "Updated Maria's shifts...", date: "Yesterday" },
  { id: 3, title: "Week of 03/02 schedule", preview: "Holiday coverage plan", date: "Mar 2" },
  { id: 4, title: "Staff availability check", preview: "Who can cover Friday?", date: "Feb 28" },
  { id: 5, title: "Week of 02/23 schedule", preview: "Full crew except Tuesday", date: "Feb 23" },
];

/* ── inline bold: **text** → <strong> ─────────────────────────── */
function parseBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((chunk, i) =>
    chunk.startsWith("**") && chunk.endsWith("**") ? (
      <strong key={i} style={{ fontWeight: 700 }}>
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      chunk
    ),
  );
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
      <path d="M9 10h.01M15 10h.01" />
      <path d="M12 2a8 8 0 0 1 8 8v10l-4-2-2 2-2-2-2 2-2-2-4 2V10a8 8 0 0 1 8-8z" />
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
function WaveformBarsIcon() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <div className="vb-bar vb-bar-1" />
      <div className="vb-bar vb-bar-2" />
      <div className="vb-bar vb-bar-3" />
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
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: "14px 16px",
        margin: "8px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        fontFamily: "'Courier New', monospace",
        fontSize: 14,
        color: "#2D2D2D",
        lineHeight: 1.55,
      }}
    >
      {content}
    </div>
  );
}

function Separator() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid #E0DAD0",
        margin: "4px 0",
      }}
    />
  );
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div
      style={{
        padding: "12px 20px",
        fontSize: 16,
        lineHeight: 1.65,
        color: "#2D2D2D",
        fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
      }}
    >
      {parseBold(content)}
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
  const [inputFocused, setInputFocused] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [pending, setPending] = useState(false);

  const scrollRef    = useRef<HTMLDivElement>(null);
  const endRef       = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);

  const isConversation = messages.length > 0;
  const isActiveInput  = isConversation || inputFocused;

  const [keyboardHeight, setKeyboardHeight]   = useState(0);

  const [weekOpen, setWeekOpen]               = useState(false);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(1); // default: next Monday
  const [ddCoords, setDdCoords]               = useState({ top: 0, left: 0 });

  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<number | null>(null);
  const [voiceActive, setVoiceActive]         = useState(false);
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
     CSS var --kb drives the input bar transform (GPU, no layout recalc). */
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
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  /* auto-scroll on new content or keyboard open/close */
  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages, pending, isAtBottom, scrollToBottom, keyboardHeight]);

  /* focus textarea when transitioning to active input */
  useEffect(() => {
    if (isActiveInput) textareaRef.current?.focus();
  }, [isActiveInput]);

  /* textarea auto-resize */
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  /* send */
  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || pending) return;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setIsAtBottom(true);
    setPending(true);

    try {
      const res  = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages((prev: Message[]) => [...prev, { role: "assistant", content: data.reply ?? data.error ?? "…" }]);
    } catch {
      setMessages((prev: Message[]) => [...prev, { role: "assistant", content: "Something went wrong." }]);
    } finally {
      setPending(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setInputValue("");
    setPending(false);
    setInputFocused(false);
  }

  return (
    <>
      <style>{`
        .claude-textarea::placeholder { color: #AAAAAA; }
        .claude-pill-input::placeholder { color: #9B9B9B; }

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
          max-height: 60px;
          transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .cl-ir {
          display: flex;
          align-items: center;
          padding: 10px 8px 10px 16px;
          gap: 8px;
          max-height: 60px;
          overflow: hidden;
          transition: max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                      opacity 0.15s ease;
        }
        .cl-ie {
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
          transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      opacity 0.2s ease 0.05s;
        }
        .cl-ia {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.2s ease 0.1s, transform 0.2s ease 0.1s;
        }

        /* ── Input bar: active / expanded — inner elements only ── */
        .cl-iw-on .cl-ic {
          border-radius: 20px;
          max-height: 300px;
          border-top: 1px solid #E5E0D8;
        }
        .cl-iw-on .cl-ir {
          max-height: 0;
          padding: 0;
          opacity: 0;
          pointer-events: none;
        }
        .cl-iw-on .cl-ie {
          max-height: 280px;
          opacity: 1;
          pointer-events: auto;
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
            z-index: 300 !important;
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

          /* Input group: centered on desktop */
          .cl-ig {
            left: 50% !important;
            right: auto !important;
            bottom: 16px !important;
            transform: translateX(-50%) translateY(calc(-1 * var(--kb, 0px))) !important;
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
          z-index: 299;
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

        /* ── Input group: stacks chat bar + voice bar ── */
        .cl-ig {
          position: fixed;
          bottom: calc(env(safe-area-inset-bottom) + 12px);
          left: 12px;
          right: 12px;
          margin: 0;
          z-index: 10;
          will-change: transform;
          transform: translateY(calc(-1 * var(--kb, 0px)));
          display: flex;
          flex-direction: column;
          gap: 10px;
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
          transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.15s ease,
                      opacity 0.2s ease;
        }
        .cl-vb:hover { background: #DDD5C8; transform: scale(0.98); }
        .cl-vb.active { background: #2D2D2D; }
        .cl-vb.active:hover { background: #3A3A3A; }

        /* Hide voice button when chat input is expanded */
        .cl-vb-wrap {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.2s ease, transform 0.2s ease;
          pointer-events: auto;
        }
        .cl-vb-wrap.hidden {
          opacity: 0;
          transform: translateY(8px);
          pointer-events: none;
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

        /* Waveform bars (active state) */
        @keyframes cl-wave {
          0%, 100% { height: 6px; }
          50%       { height: 16px; }
        }
        .vb-bar {
          width: 3px;
          border-radius: 2px;
          background: #FFFFFF;
          animation: cl-wave 0.8s ease-in-out infinite;
        }
        .vb-bar-1 { animation-delay: 0s; }
        .vb-bar-2 { animation-delay: 0.15s; }
        .vb-bar-3 { animation-delay: 0.3s; }
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
          height: isConversation ? "100vh" : undefined,
          minHeight: "100vh",
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

        {/* ── Empty state ──────────────────────────────────────── */}
        {!isConversation && (
          <div
            className="cl-empty"
            style={{
              height: typeof window !== "undefined"
                ? Math.max(200, window.innerHeight - keyboardHeight - 60 - 140) /* 60=navbar, 140=input group height */
                : undefined,
              flex: typeof window !== "undefined" ? undefined : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: 24,
              paddingRight: 24,
              transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxSizing: "border-box",
            }}
          >
            <h1
              style={{
                fontFamily: "'Tiempos Text', Georgia, 'Times New Roman', serif",
                fontSize: "clamp(18px, 3vw, 32px)",
                fontWeight: 600,
                color: "#2D2D2D",
                textAlign: "center",
                lineHeight: 1.15,
                whiteSpace: "nowrap",
                width: "100%",
                marginTop: 0,
                marginBottom: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Hi chef, Ready to create schedule?
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
              paddingTop: 4,
              paddingBottom: 185 + keyboardHeight, /* chat bar ~60px + gap 10px + voice bar ~56px + 12px bottom + extra */
            }}
          >
            <div className="cl-msgs-inner">
              {messages.map((msg: Message, i: number) => {
                const prev = messages[i - 1];
                return (
                  <div key={i}>
                    {msg.role === "user" && <UserBubble content={msg.content} />}
                    {msg.role === "assistant" && prev?.role === "user" && <Separator />}
                    {msg.role === "assistant" && <AssistantMessage content={msg.content} />}
                  </div>
                );
              })}

              {pending && (
                <div>
                  <Separator />
                  <AssistantMessage content="…" />
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>
        )}

        {/* ── Scroll-to-bottom button ──────────────────────────── */}
        {isConversation && !isAtBottom && !isActiveInput && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            style={{
              ...BTN,
              position: "fixed",
              bottom: 140,
              left: "50%",
              transform: "translateX(-50%)",
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.92)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              zIndex: 20,
            }}
          >
            <ChevronDownScrollIcon />
          </button>
        )}

        {/* ── Input group: chat bar + voice bar ───────────────── */}
        <div className="cl-ig">

        {/* Chat input bar */}
        <div className={`cl-iw${isActiveInput ? " cl-iw-on" : ""}`}>
          <div className="cl-ic">

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
                onFocus={() => setInputFocused(true)}
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
                style={{ ...BTN, width: 40, height: 40, borderRadius: "50%", backgroundColor: "#000" }}
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
                onFocus={() => setInputFocused(true)}
                onBlur={() => { if (!isConversation && !pending) setInputFocused(false); }}
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
                    style={{ ...BTN, width: 40, height: 40, borderRadius: "50%", backgroundColor: "#1A1A1A" }}
                  >
                    <WaveformIcon />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>{/* end .cl-iw */}

        {/* Voice AI entry button */}
        <div className={`cl-vb-wrap${isActiveInput ? " hidden" : ""}`}>
          <button
            type="button"
            className={`cl-vb${voiceActive ? " active" : ""}`}
            onClick={() => {
              // TODO: connect to Vapi voice agent
              setVoiceActive((v) => !v);
            }}
          >
            <MicOutlineIcon white={voiceActive} />
            <span style={{
              fontSize: 15, fontWeight: 500,
              color: voiceActive ? "#FFFFFF" : "#6B6259",
              fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
              flex: 1, textAlign: "center", margin: "0 12px",
            }}>
              {voiceActive ? "Listening..." : "Voice chat with scheduled.ai"}
            </span>
            {voiceActive ? <WaveformBarsIcon /> : <div className="cl-vb-dot" />}
          </button>
        </div>

        </div>{/* end .cl-ig */}
      </div>
    </>
  );
}
