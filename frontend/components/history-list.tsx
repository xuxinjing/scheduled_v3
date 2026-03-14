"use client";

import Link from "next/link";
import { FileSpreadsheet, History as HistoryIcon, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  if (loading) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-[hsl(var(--muted-foreground))]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading schedule history...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="py-6 text-sm text-[hsl(var(--danger))]">{error}</CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="py-6 text-sm text-[hsl(var(--muted-foreground))]">
          No saved schedules yet. Generate one from the main screen first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="rounded-[24px]">
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <p className="truncate text-base font-semibold text-[hsl(var(--foreground))]">Week of {item.week_start}</p>
                </div>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                  {item.restaurant_name} · created {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={item.status.includes("FAIL") ? "danger" : item.status.includes("WARNING") ? "warning" : "success"}>
                  {item.status}
                </Badge>
                {item.email_sent_at ? <Badge variant="success">Emailed</Badge> : <Badge variant="muted">Saved</Badge>}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="truncate">{item.id}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/history/${item.id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
                View run
              </Link>
              {item.has_excel ? (
                <Link href={`/api/history/${item.id}/artifacts/schedule_output.xlsx`} className={buttonVariants({ size: "sm" })}>
                  Download Excel
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
