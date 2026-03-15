import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleRun, WeekConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

function cellColor(cell: ScheduleRun["pivot_preview"]["rows"][number]["cells"][string]) {
  if (cell.text === "CLOSED") return "bg-[#f5f5f7] text-[#86868b]";
  if (cell.text === "OFF") return "bg-[#fafafa] text-[#aeaeb2]";
  const coverage = new Set(cell.entries.map((entry) => entry.coverage_type));
  const shifts = new Set(cell.entries.map((entry) => entry.shift));
  if (coverage.has("training")) return "bg-violet-50 text-violet-800";
  if (coverage.has("learning")) return "bg-amber-50 text-amber-800";
  if (shifts.size === 1 && shifts.has("AM")) return "bg-sky-50 text-sky-800";
  if (shifts.size === 1 && shifts.has("PM")) return "bg-orange-50 text-orange-800";
  return "bg-emerald-50 text-emerald-800";
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
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Schedule preview</CardTitle>
            <p className="mt-0.5 text-[13px] text-[#86868b]">
              Week of {schedule.context.week_start} &middot; {schedule.report.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="muted">AM</Badge>
            <Badge variant="default">PM</Badge>
            <Badge variant="warning">Learning</Badge>
            <Badge variant="success">Training</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-[10px] border border-[#e8e8ed]">
          <table className="min-w-[980px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f5f5f7]">
                <th className="sticky left-0 z-20 border-b border-r border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2.5 text-left text-[13px] font-semibold text-[#1d1d1f]">
                  Employee
                </th>
                {schedule.pivot_preview.days.map((day) => (
                  <th key={day} className="min-w-[120px] border-b border-[#e8e8ed] px-3 py-2.5 text-center text-[13px] font-semibold text-[#1d1d1f]">
                    {day.slice(0, 3)}
                  </th>
                ))}
              </tr>
              <tr>
                <td className="sticky left-0 z-20 border-b border-r border-[#e8e8ed] bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#86868b]">
                  Service
                </td>
                {schedule.pivot_preview.days.map((day) => {
                  const service = day === "Monday" || day === "Sunday" ? "closed" : weekConfig?.service_levels?.[day] ?? "closed";
                  return (
                    <td key={day} className="border-b border-[#e8e8ed] px-3 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.04em] text-[#86868b]">
                      {service}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([role, rows]) => (
                <Fragment key={role}>
                  <tr className="bg-[#1d1d1f]">
                    <td colSpan={schedule.pivot_preview.days.length + 1} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-white">
                      {roleLabels[role] ?? role}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.employee} className="align-top">
                      <td className="sticky left-0 border-r border-t border-[#e8e8ed] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f]">
                        {row.employee}
                      </td>
                      {schedule.pivot_preview.days.map((day) => {
                        const cell = row.cells[day];
                        return (
                          <td key={`${row.employee}-${day}`} className={cn("border-t border-[#e8e8ed] px-3 py-2.5", cellColor(cell))}>
                            <div className="min-h-[60px] whitespace-pre-wrap text-[13px] leading-5">{cell.text}</div>
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
