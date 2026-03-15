import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-[36px] w-full rounded-[10px] border-0 bg-black/[0.04] px-3 text-[14px] text-[#1d1d1f] outline-none transition placeholder:text-[#c7c7cc] focus:ring-2 focus:ring-[hsl(var(--primary))]/20",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
