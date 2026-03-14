import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "muted";
};

const styles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
  success: "border border-[hsl(var(--success))]/15 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  warning: "border border-[hsl(var(--warning))]/15 bg-[hsl(var(--warning))]/10 text-[#b45309]",
  danger: "border border-[hsl(var(--danger))]/15 bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]",
  muted: "border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
