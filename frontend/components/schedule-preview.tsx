import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleRun, WeekConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

function cellColor(cell: ScheduleRun["pivot_preview"]["rows"][number]["cells"][string]) {
  if (cell.text === "CLOSED") {
    return "bg-stone-200 text-stone-500";
  }
  if (cell.text === "OFF") {
    return "bg-stone-100 text-stone-400";
  }
  const coverage = new Set(cell.entries.map((entry) => entry.coverage_type));
  const shifts = new Set(cell.entries.map((entry) => entry.shift));
  if (coverage.has("training")) {
    return "bg-violet-100 text-violet-900";
  }
  if (coverage.has("learning")) {
    return "bg-amber-100 text-amber-950";
  }
  if (shifts.size === 1 && shifts.has("AM")) {
    return "bg-sky-100 text-sky-950";
  }
  if (shifts.size === 1 && shifts.has("PM")) {
    return "bg-orange-100 text-orange-950";
  }
  return "bg-emerald-100 text-emerald-950";
}

const roleLabels: Record<string, string> = {
  leadership: "Leadership",
  pm_staff: "PM Line",
  am_staff: "AM Prep",
};

export function SchedulePreview({ schedule, weekConfig }: { schedule: ScheduleRun; weekConfig: WeekConfig | null }) {
  const groups = schedule.pivot_preview.rows.reduce<Record<string, typeof schedule.pivot_preview.rows>>((accumulator, row) => {
    accumulator[row.role] ??= [];
    accumulator[row.role].push(row);
    return accumulator;
  }, {});

  return (
    <Card className="animate-rise-in overflow-hidden">
      <CardHeader className="border-b border-[hsl(var(--border))]/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Weekly Pivot Preview</CardTitle>
            <CardDescription>
              Week of {schedule.context.week_start} · {schedule.report.status}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">AM blue</Badge>
            <Badge variant="warning">Learning yellow</Badge>
            <Badge variant="default">PM orange</Badge>
            <Badge variant="success">Cross-shift green</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="scrollbar-thin overflow-x-auto rounded-[1.5rem] border border-[hsl(var(--border))]/70">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[hsl(var(--muted))]">
                <th className="sticky left-0 z-10 border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3 text-left font-[family-name:var(--font-heading)]">
                  Employee
                </th>
                {schedule.pivot_preview.days.map((day) => (
                  <th key={day} className="min-w-[150px] border-b border-[hsl(var(--border))] px-3 py-3 text-center font-[family-name:var(--font-heading)]">
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-10 border-b border-r border-[hsl(var(--border))] bg-white px-4 py-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                  Service
                </td>
                {schedule.pivot_preview.days.map((day) => {
                  const service =
                    day === "Monday" || day === "Sunday"
                      ? "closed"
                      : weekConfig?.service_levels?.[day] ?? "closed";
                  return (
                    <td key={day} className="border-b border-[hsl(var(--border))] px-3 py-2 text-center text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                      {service}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([role, rows]) => (
                <Fragment key={role}>
                  <tr className="bg-[hsl(var(--foreground))] text-white">
                    <td colSpan={schedule.pivot_preview.days.length + 1} className="px-4 py-2 font-[family-name:var(--font-heading)] text-xs uppercase tracking-[0.3em]">
                      {roleLabels[role] ?? role}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.employee} className="align-top">
                      <td className="sticky left-0 border-r border-t border-[hsl(var(--border))] bg-white px-4 py-3 font-semibold">
                        {row.employee}
                      </td>
                      {schedule.pivot_preview.days.map((day) => {
                        const cell = row.cells[day];
                        return (
                          <td key={`${row.employee}-${day}`} className={cn("border-t border-[hsl(var(--border))] px-3 py-3", cellColor(cell))}>
                            <div className="min-h-[72px] whitespace-pre-wrap text-sm leading-5">{cell.text}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
