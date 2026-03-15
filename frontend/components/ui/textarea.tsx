import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[100px] w-full rounded-[10px] border-0 bg-black/[0.04] px-3 py-2.5 text-[14px] text-[#1d1d1f] outline-none transition placeholder:text-[#c7c7cc] focus:ring-2 focus:ring-[hsl(var(--primary))]/20",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
