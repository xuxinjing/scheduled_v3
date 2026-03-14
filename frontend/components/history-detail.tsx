"use client";

import Link from "next/link";
import { Download, FileText, MailCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleDetail } from "@/lib/types";

export function HistoryDetail({ detail }: { detail: ScheduleDetail }) {
  const reportWarnings = detail.report.warnings ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Week of {detail.context.week_start}</CardTitle>
            <CardDescription>
              {detail.context.restaurant_name} · generated {new Date(detail.created_at).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={detail.report.status.includes("FAIL") ? "danger" : detail.report.status.includes("WARNING") ? "warning" : "success"}>
              {detail.report.status}
            </Badge>
            {detail.email_sent_at ? <Badge variant="success">Emailed</Badge> : <Badge variant="muted">Not emailed</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href={`/api/history/${detail.id}/artifacts/schedule_output.xlsx`} className={buttonVariants()}>
            <Download className="h-4 w-4" />
            Download Excel
          </Link>
          <Link
            href={`/api/history/${detail.id}/artifacts/validator_report.md`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <FileText className="h-4 w-4" />
            Download report
          </Link>
          {detail.email_sent_at && (
            <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--success))]/10 px-3 py-2 text-sm text-[hsl(var(--success))]">
              <MailCheck className="h-4 w-4" />
              Sent to {detail.email_recipient ?? "configured recipient"}
            </span>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" />
              <p className="font-medium">Warnings</p>
            </div>
            {reportWarnings.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No warnings for this run.</p>
            ) : (
              <ul className="space-y-2 text-sm text-[hsl(var(--foreground))]">
                {reportWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-4">
            <p className="mb-3 font-medium">Validator report</p>
            <pre className="scrollbar-thin max-h-[420px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-[hsl(var(--foreground))]">
              {detail.report_markdown}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
