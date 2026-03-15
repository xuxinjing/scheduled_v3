import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-[var(--tenant-border-color)] bg-white/88 px-4 py-2 text-sm text-[hsl(var(--foreground))] shadow-[0_8px_18px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-[hsl(var(--muted-foreground))] backdrop-blur-md focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--ring))]/15",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
