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

function ReasoningLine({ event, active }: { event: ReasoningEvent; active: boolean }) {
  const target = typeof event.content === "string" ? event.content : event.summary ?? "";
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
    const charsPerSecond = 46;
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
        "flex gap-3 rounded-xl border px-3 py-3 transition",
        event.type === "phase"
          ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/40"
          : "border-[hsl(var(--border))] bg-white",
        active && "border-[hsl(var(--primary))]/35",
      )}
    >
      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--secondary))]">
        {statusIcon(event)}
      </div>
      <p className={cn("min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6", event.type === "phase" && "font-medium")}>
        {visible}
      </p>
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
      const timeout = window.setTimeout(() => setCollapsed(true), 900);
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
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-[var(--tenant-border-color)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563eb]">Progress</p>
            <CardTitle className="mt-1 text-[24px] tracking-[-0.03em]">Schedule generation</CardTitle>
            <CardDescription>Integrity check and solver progress stream here in real time.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <Badge variant="warning">Live</Badge>
            ) : finalEvent ? (
              <Badge variant="success">Complete</Badge>
            ) : (
              <Badge variant="muted">Idle</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)}>
              {collapsed ? "Show" : "Hide"}
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-5">
          <div
            ref={bodyRef}
            className="scrollbar-thin max-h-[360px] space-y-3 overflow-y-auto rounded-[20px] bg-[#f8fafc] p-3"
          >
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-white px-4 py-5 text-sm text-[hsl(var(--muted-foreground))]">
                Confirm the week and the system will stream its checks here.
              </div>
            ) : (
              events.map((event, index) => (
                <ReasoningLine
                  key={`${event.type}-${index}-${typeof event.content === "string" ? event.content : event.summary ?? "event"}`}
                  event={event}
                  active={index === activeIndex}
                />
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
