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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Link href={`/api/history/${detail.id}/artifacts/schedule_output.xlsx`} className={buttonVariants({ size: "sm" })}>
            <Download className="h-4 w-4" />
            Download Excel
          </Link>
          <Link href={`/api/history/${detail.id}/artifacts/validator_report.md`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
            <FileText className="h-4 w-4" />
            Download report
          </Link>
          {detail.email_sent_at ? (
            <span className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--success))]/15 bg-[hsl(var(--success))]/10 px-3 py-2 text-sm text-[hsl(var(--success))]">
              <MailCheck className="h-4 w-4" />
              Sent to {detail.email_recipient ?? "configured recipient"}
            </span>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" />
              <CardTitle className="text-base">Warnings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {reportWarnings.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No warnings for this run.</p>
            ) : (
              <ul className="space-y-2 text-sm text-[hsl(var(--foreground))]">
                {reportWarnings.map((warning) => (
                  <li key={warning} className="rounded-xl bg-[hsl(var(--secondary))] px-3 py-2">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validator report</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="scrollbar-thin max-h-[480px] overflow-auto rounded-xl bg-[hsl(var(--secondary))]/55 p-4 text-xs leading-6 text-[hsl(var(--foreground))]">
              {detail.report_markdown}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
