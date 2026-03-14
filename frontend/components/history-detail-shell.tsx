"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { HistoryDetail } from "@/components/history-detail";
import { Card, CardContent } from "@/components/ui/card";
import type { ScheduleDetail } from "@/lib/types";

export function HistoryDetailShell({ scheduleId }: { scheduleId: string }) {
  const [detail, setDetail] = useState<ScheduleDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/history?id=${scheduleId}`)
      .then(async (response) => {
        const data = (await response.json()) as ScheduleDetail & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Failed to load schedule detail");
        }
        setDetail(data);
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Failed to load schedule detail"));
  }, [scheduleId]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-[hsl(var(--foreground))]">{error}</CardContent>
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-[hsl(var(--muted-foreground))]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading schedule detail...
        </CardContent>
      </Card>
    );
  }

  return <HistoryDetail detail={detail} />;
}
