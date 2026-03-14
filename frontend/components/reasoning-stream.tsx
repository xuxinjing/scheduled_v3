"use client";

import { AlertTriangle, Check, ChevronDown, ChevronUp, LoaderCircle, Sparkles, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReasoningEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

function statusIcon(event: ReasoningEvent) {
  if (event.type === "phase") {
    return <Sparkles className="h-4 w-4" />;
  }
  if (event.type === "code_fix" || event.type === "code_change") {
    return <Wrench className="h-4 w-4" />;
  }
  if (event.type === "error" || event.status === "failed" || event.status === "fail") {
    return <X className="h-4 w-4 text-[hsl(var(--danger))]" />;
  }
  if (event.status === "warning" || event.status === "warn") {
    return <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />;
  }
  if (event.status === "complete" || event.status === "pass" || event.type === "summary") {
    return <Check className="h-4 w-4 text-[hsl(var(--success))]" />;
  }
  return <LoaderCircle className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />;
}

function AnimatedLine({ event, active }: { event: ReasoningEvent; active: boolean }) {
  const target = typeof event.content === "string" ? event.content : (event.summary ?? "");
  const [visible, setVisible] = useState(event.type === "phase" || event.type === "complete" ? target : "");

  useEffect(() => {
    if (!target) {
      return;
    }
    if (event.type === "phase" || event.type === "complete") {
      setVisible(target);
      return;
    }

    let frame = 0;
    let raf = 0;
    const charsPerSecond = 52;
    const step = () => {
      frame += 1;
      const count = Math.min(target.length, Math.floor((frame / 60) * charsPerSecond));
      setVisible(target.slice(0, count));
      if (count < target.length) {
        raf = requestAnimationFrame(step);
      }
    };
    setVisible("");
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [event.type, target]);

  return (
    <div
      className={cn(
        "flex gap-3 rounded-[1.25rem] border border-transparent px-3 py-3 transition",
        event.type === "phase" && "animate-rise-in border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/7",
        active && event.type !== "phase" && "bg-white/70",
      )}
    >
      <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90", active && "animate-pulse-soft")}>
        {statusIcon(event)}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--foreground))]",
            event.type === "phase" && "font-[family-name:var(--font-heading)] text-base",
          )}
        >
          {visible}
        </p>
      </div>
    </div>
  );
}

type ReasoningStreamProps = {
  events: ReasoningEvent[];
  running: boolean;
  collapsedByDefault?: boolean;
};

export function ReasoningStream({ events, running, collapsedByDefault = false }: ReasoningStreamProps) {
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (running) {
      setCollapsed(false);
    }
  }, [running]);

  useEffect(() => {
    if (!running && events.some((event) => event.type === "complete")) {
      const timeout = window.setTimeout(() => setCollapsed(true), 700);
      return () => window.clearTimeout(timeout);
    }
  }, [events, running]);

  useEffect(() => {
    if (!bodyRef.current || collapsed) {
      return;
    }
    const element = bodyRef.current;
    const timeout = window.setTimeout(() => {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timeout);
  }, [collapsed, events]);

  const finalEvent = events.at(-1);
  const activeIndex = running ? events.length - 1 : -1;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[hsl(var(--border))]/60 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Reasoning Stream</CardTitle>
            <CardDescription>
              Live integrity and solver feedback, paced for review instead of hidden behind a spinner.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {running ? <Badge variant="warning">Live</Badge> : finalEvent ? <Badge variant="success">Ready</Badge> : <Badge variant="muted">Waiting</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)}>
              {collapsed ? "Expand" : "Collapse"}
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4 pt-6">
          <div
            ref={bodyRef}
            className="scrollbar-thin max-h-[460px] space-y-3 overflow-y-auto rounded-[1.5rem] border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/40 p-4"
          >
            {events.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-[hsl(var(--border))] px-4 py-6 text-sm text-[hsl(var(--muted-foreground))]">
                Confirm the interpreted week and the reasoning stream will start within the same screen.
              </div>
            ) : (
              events.map((event, index) => (
                <AnimatedLine
                  key={`${event.type}-${index}-${typeof event.content === "string" ? event.content : event.summary ?? "event"}`}
                  event={event}
                  active={index === activeIndex}
                />
              ))
            )}
          </div>
          {running && (
            <div className="overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div className="h-2 w-full animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(170,96,52,0.7),transparent)] bg-[length:200%_100%]" />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
