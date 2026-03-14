import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-[hsl(var(--border))] bg-white/90 px-4 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--ring))]/20",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
