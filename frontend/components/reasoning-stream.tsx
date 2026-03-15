"use client";

import { AlertTriangle, Check, ChevronDown, ChevronUp, LoaderCircle, Sparkles, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReasoningEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

function statusIcon(event: ReasoningEvent) {
  if (event.type === "phase") return <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />;
  if (event.type === "code_fix" || event.type === "code_change") return <Wrench className="h-3.5 w-3.5 text-[#86868b]" />;
  if (event.type === "error" || event.status === "failed" || event.status === "fail") return <X className="h-3.5 w-3.5 text-[hsl(var(--danger))]" />;
  if (event.status === "warning" || event.status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />;
  if (event.status === "complete" || event.status === "pass" || event.type === "summary") return <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />;
  return <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[hsl(var(--primary))]" />;
}

function ReasoningLine({ event, active }: { event: ReasoningEvent; active: boolean }) {
  const target = typeof event.content === "string" ? event.content : event.summary ?? "";
  const [visible, setVisible] = useState(event.type === "phase" || event.type === "complete" ? target : "");

  useEffect(() => {
    if (!target) return;
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
      if (count < target.length) raf = requestAnimationFrame(step);
    };
    setVisible("");
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [event.type, target]);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 transition-colors",
        event.type === "phase" ? "bg-[hsl(var(--primary))]/[0.06]" : "bg-black/[0.02]",
        active && "bg-[hsl(var(--primary))]/[0.08]",
      )}
    >
      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">{statusIcon(event)}</div>
      <p className={cn("min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-5", event.type === "phase" && "font-medium")}>
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
    if (running) setCollapsed(false);
  }, [running]);

  useEffect(() => {
    if (!running && events.some((event) => event.type === "complete")) {
      const timeout = window.setTimeout(() => setCollapsed(true), 900);
      return () => window.clearTimeout(timeout);
    }
  }, [events, running]);

  useEffect(() => {
    if (!bodyRef.current || collapsed) return;
    const element = bodyRef.current;
    const timeout = window.setTimeout(() => {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timeout);
  }, [collapsed, events]);

  const finalEvent = events.at(-1);
  const activeIndex = running ? events.length - 1 : -1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CardTitle>Generation progress</CardTitle>
            {running ? (
              <Badge variant="warning">Live</Badge>
            ) : finalEvent ? (
              <Badge variant="success">Done</Badge>
            ) : (
              <Badge variant="muted">Idle</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          <div ref={bodyRef} className="max-h-[320px] space-y-1 overflow-y-auto">
            {events.length === 0 ? (
              <div className="rounded-[10px] bg-black/[0.02] px-4 py-4 text-[13px] text-[#86868b]">
                The system will stream its checks here.
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
