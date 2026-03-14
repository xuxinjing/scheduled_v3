import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleRun, WeekConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

function cellColor(cell: ScheduleRun["pivot_preview"]["rows"][number]["cells"][string]) {
  if (cell.text === "CLOSED") {
    return "bg-slate-200 text-slate-500";
  }
  if (cell.text === "OFF") {
    return "bg-slate-100 text-slate-500";
  }
  const coverage = new Set(cell.entries.map((entry) => entry.coverage_type));
  const shifts = new Set(cell.entries.map((entry) => entry.shift));
  if (coverage.has("training")) {
    return "bg-violet-100 text-violet-900";
  }
  if (coverage.has("learning")) {
    return "bg-amber-100 text-amber-900";
  }
  if (shifts.size === 1 && shifts.has("AM")) {
    return "bg-sky-100 text-sky-900";
  }
  if (shifts.size === 1 && shifts.has("PM")) {
    return "bg-orange-100 text-orange-900";
  }
  return "bg-emerald-100 text-emerald-900";
}

const roleLabels: Record<string, string> = {
  leadership: "Leadership",
  pm_staff: "PM line",
  am_staff: "AM prep",
};

export function SchedulePreview({ schedule, weekConfig }: { schedule: ScheduleRun; weekConfig: WeekConfig | null }) {
  const groups = schedule.pivot_preview.rows.reduce<Record<string, typeof schedule.pivot_preview.rows>>((accumulator, row) => {
    accumulator[row.role] ??= [];
    accumulator[row.role].push(row);
    return accumulator;
  }, {});

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[hsl(var(--border))]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Schedule preview</CardTitle>
            <CardDescription>
              Week of {schedule.context.week_start} · {schedule.report.status}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">AM</Badge>
            <Badge variant="default">PM</Badge>
            <Badge variant="warning">Learning</Badge>
            <Badge variant="success">Training / mixed</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="scrollbar-thin overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
          <table className="min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-[hsl(var(--secondary))]">
                <th className="sticky left-0 z-20 border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-3 text-left font-semibold">
                  Employee
                </th>
                {schedule.pivot_preview.days.map((day) => (
                  <th key={day} className="min-w-[132px] border-b border-[hsl(var(--border))] px-3 py-3 text-center font-semibold">
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-20 border-b border-r border-[hsl(var(--border))] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
                  Service
                </td>
                {schedule.pivot_preview.days.map((day) => {
                  const service = day === "Monday" || day === "Sunday" ? "closed" : weekConfig?.service_levels?.[day] ?? "closed";
                  return (
                    <td
                      key={day}
                      className="border-b border-[hsl(var(--border))] px-3 py-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]"
                    >
                      {service}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([role, rows]) => (
                <Fragment key={role}>
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={schedule.pivot_preview.days.length + 1} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                      {roleLabels[role] ?? role}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.employee} className="align-top">
                      <td className="sticky left-0 border-r border-t border-[hsl(var(--border))] bg-white px-4 py-3 font-medium">
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
