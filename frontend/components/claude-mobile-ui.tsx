"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

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
function AnthropicAsterisk() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => {
        const r = ((i * 360) / 8) * (Math.PI / 180);
        return (
          <line
            key={i}
            x1={24 + 5 * Math.cos(r)} y1={24 + 5 * Math.sin(r)}
            x2={24 + 20 * Math.cos(r)} y2={24 + 20 * Math.sin(r)}
            stroke="#C96A4A" strokeWidth="3.2" strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="2"  y1="12" x2="2"  y2="12" />
      <line x1="5"  y1="9"  x2="5"  y2="15" />
      <line x1="8"  y1="6"  x2="8"  y2="18" />
      <line x1="11" y1="4"  x2="11" y2="20" />
      <line x1="14" y1="6"  x2="14" y2="18" />
      <line x1="17" y1="9"  x2="17" y2="15" />
      <line x1="20" y1="11" x2="20" y2="13" />
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

  /* scroll helpers */
  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  /* auto-scroll on new content */
  useEffect(() => {
    if (isAtBottom) scrollToBottom();
  }, [messages, pending, isAtBottom, scrollToBottom]);

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

        /* ── Desktop: phone-frame centered on white page ── */
        @media (min-width: 768px) {
          body { background-color: #FFFFFF; }

          .cl-col {
            width: 448px !important;
            max-width: 448px !important;
            margin: 0 auto !important;
            box-shadow: 0 0 40px rgba(0,0,0,0.08);
          }

          .cl-nav {
            position: fixed !important;
            top: 0 !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 448px !important;
            padding-top: 16px !important;
            z-index: 30;
            background-color: #F4EFE6;
          }

          /* push content below fixed nav */
          .cl-empty  { padding-top: 80px; }
          .cl-msgs   { padding-top: 80px !important; }

          .cl-input-pill {
            position: fixed !important;
            bottom: 0 !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 448px !important;
          }

          .cl-input-rect {
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 448px !important;
            right: auto !important;
          }
        }
      `}</style>

      <div
        className="cl-col"
        style={{
          width: "100vw",
          height: isConversation ? "100vh" : undefined,
          minHeight: "100vh",
          backgroundColor: "#F4EFE6",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
          boxSizing: "border-box",
          overflow: isConversation ? "hidden" : undefined,
          margin: 0,
          padding: 0,
        }}
      >
        {/* ── Nav ──────────────────────────────────────────────── */}
        <nav
          className="cl-nav"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 52,
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: 8,
            backgroundColor: "#F4EFE6",
            flexShrink: 0,
          }}
        >
          <button type="button" aria-label="Menu" style={{ ...NAV_BTN, backgroundColor: "#EFEFEF" }}>
            <HamburgerIcon />
          </button>

          <div style={{ textAlign: "center", flex: 1, margin: "0 8px" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#2D2D2D", lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              Sonnet 4.6<ChevronDownTitleIcon />
            </div>
            <div style={{ fontSize: 12, color: "#9B9B9B", marginTop: 1 }}>Extended</div>
          </div>

          {isConversation ? (
            <button
              type="button"
              aria-label="New conversation"
              onClick={resetConversation}
              style={{ ...NAV_BTN, backgroundColor: "#C96A4A" }}
            >
              <PlusWhiteIcon />
            </button>
          ) : (
            <button type="button" aria-label="Incognito" style={{ ...NAV_BTN, backgroundColor: "#EFEFEF", color: "#2D2D2D" }}>
              <GhostIcon />
            </button>
          )}
        </nav>

        {/* ── Empty state ──────────────────────────────────────── */}
        {!isConversation && (
          <div
            className="cl-empty"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: 120,
              paddingLeft: 24,
              paddingRight: 24,
            }}
          >
            <AnthropicAsterisk />
            <h1
              style={{
                fontFamily: "'Tiempos Text', Georgia, 'Times New Roman', serif",
                fontSize: 28,
                fontWeight: 600,
                color: "#2D2D2D",
                textAlign: "center",
                lineHeight: 1.15,
                maxWidth: 280,
                marginTop: 20,
                marginBottom: 0,
                letterSpacing: "-0.01em",
              }}
            >
              How can I help you this morning?
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
              paddingBottom: 130,
            }}
          >
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
        )}

        {/* ── Scroll-to-bottom button ──────────────────────────── */}
        {isConversation && !isAtBottom && (
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

        {/* ── Input: pill (empty, unfocused) ───────────────────── */}
        {!isActiveInput && (
          <div
            className="cl-input-pill"
            style={{
              position: "sticky",
              bottom: 0,
              backgroundColor: "#F4EFE6",
              padding: "8px 16px 28px",
            }}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                paddingLeft: 16,
                paddingRight: 8,
                paddingTop: 10,
                paddingBottom: 10,
                gap: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
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
                placeholder="Chat with Claude"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 16,
                  color: "#2D2D2D",
                  fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
                  minWidth: 0,
                }}
              />

              <button type="button" aria-label="Voice input" style={BTN}>
                <MicIcon />
              </button>

              <button
                type="button"
                aria-label="Send"
                onClick={() => void sendMessage()}
                style={{ ...BTN, width: 40, height: 40, borderRadius: "50%", backgroundColor: "#000000" }}
              >
                <WaveformIcon />
              </button>
            </div>
          </div>
        )}

        {/* ── Input: rectangle (active / conversation) ─────────── */}
        {isActiveInput && (
          <div
            className="cl-input-rect"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#F4EFE6",
              borderTop: "1px solid #E5E0D8",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              zIndex: 10,
            }}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                padding: "12px 16px",
                margin: 0,
              }}
            >
              <textarea
                ref={textareaRef}
                className="claude-textarea"
                value={inputValue}
                rows={1}
                placeholder="Reply to Claude"
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setInputValue(e.target.value); autoResize(); }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => { if (!isConversation && !pending) setInputFocused(false); }}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  resize: "none",
                  fontSize: 16,
                  color: "#2D2D2D",
                  fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
                  minHeight: 48,
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                  display: "block",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <button type="button" aria-label="Attach" style={BTN}>
                  <PlusGrayIcon color="#888" size={22} />
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" aria-label="Voice input" style={BTN}>
                    <MicIcon color="#888" />
                  </button>
                  <button
                    type="button"
                    aria-label="Send"
                    onClick={() => void sendMessage()}
                    style={{ ...BTN, width: 40, height: 40, borderRadius: "50%", backgroundColor: "#1A1A1A" }}
                  >
                    <WaveformIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
