"use client";

import { useState } from "react";

/* ── Anthropic asterisk SVG ────────────────────────────────────── */
function AnthropicAsterisk() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 8 rays emanating from center */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 360) / 8;
        const rad = (angle * Math.PI) / 180;
        const x1 = 24 + 5 * Math.cos(rad);
        const y1 = 24 + 5 * Math.sin(rad);
        const x2 = 24 + 20 * Math.cos(rad);
        const y2 = 24 + 20 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#C96A4A"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/* ── Ghost / Incognito icon ────────────────────────────────────── */
function GhostIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 10h.01M15 10h.01" />
      <path d="M12 2a8 8 0 0 1 8 8v10l-4-2-2 2-2-2-2 2-2-2-4 2V10a8 8 0 0 1 8-8z" />
    </svg>
  );
}

/* ── Microphone icon ───────────────────────────────────────────── */
function MicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9B9B9B"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  );
}

/* ── Waveform / soundwave icon ─────────────────────────────────── */
function WaveformIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="2" y1="12" x2="2" y2="12" />
      <line x1="5" y1="9" x2="5" y2="15" />
      <line x1="8" y1="6" x2="8" y2="18" />
      <line x1="11" y1="4" x2="11" y2="20" />
      <line x1="14" y1="6" x2="14" y2="18" />
      <line x1="17" y1="9" x2="17" y2="15" />
      <line x1="20" y1="11" x2="20" y2="13" />
    </svg>
  );
}

/* ── Hamburger icon ────────────────────────────────────────────── */
function HamburgerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2D2D2D"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/* ── Chevron down ──────────────────────────────────────────────── */
function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2D2D2D"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 2 }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Plus icon ─────────────────────────────────────────────────── */
function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9B9B9B"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/* ── Main component ────────────────────────────────────────────── */
export function ClaudeMobileUI() {
  const [inputValue, setInputValue] = useState("");

  return (
    <div
      style={{
        width: 375,
        minHeight: "100vh",
        backgroundColor: "#F2EDE4",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, 'Inter', sans-serif",
        position: "relative",
        margin: "0 auto",
      }}
    >
      {/* ── Top navigation bar ───────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 52,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 8,
          backgroundColor: "#F2EDE4",
        }}
      >
        {/* Hamburger button */}
        <button
          type="button"
          aria-label="Open menu"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.75)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <HamburgerIcon />
        </button>

        {/* Center title */}
        <div style={{ textAlign: "center", flex: 1, marginLeft: 8, marginRight: 8 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#2D2D2D",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            Sonnet 4.6
            <ChevronDownIcon />
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "#9B9B9B",
              marginTop: 1,
            }}
          >
            Extended
          </div>
        </div>

        {/* Ghost / incognito button */}
        <button
          type="button"
          aria-label="Incognito mode"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.75)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#2D2D2D",
          }}
        >
          <GhostIcon />
        </button>
      </nav>

      {/* ── Center empty state ────────────────────────────────────── */}
      <div
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
        {/* Anthropic asterisk */}
        <AnthropicAsterisk />

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'Tiempos Text', Georgia, 'Times New Roman', serif",
            fontSize: 32,
            fontWeight: 700,
            color: "#2D2D2D",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 280,
            marginTop: 20,
            marginBottom: 0,
            letterSpacing: "-0.02em",
          }}
        >
          How can I help you this morning?
        </h1>
      </div>

      {/* ── Bottom input bar ─────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "8px 12px 28px",
          backgroundColor: "#F2EDE4",
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
            boxShadow: "0 2px 12px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Plus button */}
          <button
            type="button"
            aria-label="Add attachment"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <PlusIcon />
          </button>

          {/* Text input */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
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

          {/* Microphone icon */}
          <button
            type="button"
            aria-label="Voice input"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <MicIcon />
          </button>

          {/* Waveform / send button */}
          <button
            type="button"
            aria-label="Send audio"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: "#000000",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <WaveformIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
