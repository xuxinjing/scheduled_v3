import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "muted";
};

const styles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]",
  success: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning))]/10 text-[#946800]",
  danger: "bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]",
  muted: "bg-black/[0.04] text-[#86868b]",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
