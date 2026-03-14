import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[132px] w-full rounded-[1.5rem] border border-[hsl(var(--border))] bg-white/90 px-4 py-3 text-sm text-[hsl(var(--foreground))] shadow-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--ring))]/20",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
