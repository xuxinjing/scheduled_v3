import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "muted";
};

const styles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]",
  success: "bg-[hsl(var(--success))]/12 text-[hsl(var(--success))]",
  warning: "bg-[hsl(var(--warning))]/14 text-[hsl(var(--foreground))]",
  danger: "bg-[hsl(var(--danger))]/12 text-[hsl(var(--danger))]",
  muted: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
