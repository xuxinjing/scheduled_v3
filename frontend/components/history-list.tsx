"use client";

import Link from "next/link";
import { FileSpreadsheet, History as HistoryIcon, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleListItem } from "@/lib/types";

export function HistoryList() {
  const [items, setItems] = useState<ScheduleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/history")
      .then(async (response) => {
        const data = (await response.json()) as { items?: ScheduleListItem[]; error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Failed to load history");
        }
        setItems(data.items ?? []);
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past schedules</CardTitle>
        <CardDescription>Recent generated weeks from the backend schedule history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-3 rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/80 p-6 text-sm text-[hsl(var(--muted-foreground))]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading schedule history...
          </div>
        ) : error ? (
          <div className="rounded-[1.5rem] border border-[hsl(var(--danger))]/20 bg-[hsl(var(--danger))]/10 p-6 text-sm text-[hsl(var(--foreground))]">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[hsl(var(--border))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
            No saved schedules yet. Generate one from the main screen first.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/80 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <p className="font-semibold">Week of {item.week_start}</p>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {item.restaurant_name} · created {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.status.includes("FAIL") ? "danger" : item.status.includes("WARNING") ? "warning" : "success"}>
                  {item.status}
                </Badge>
                {item.email_sent_at ? <Badge variant="success">Emailed</Badge> : <Badge variant="muted">Queued only</Badge>}
                <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs">
                  <FileSpreadsheet className="h-4 w-4" />
                  {item.id}
                </span>
                <Link href={`/history/${item.id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
                  View
                </Link>
                {item.has_excel && (
                  <Link href={`/api/history/${item.id}/artifacts/schedule_output.xlsx`} className={buttonVariants({ size: "sm" })}>
                    Download Excel
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
