import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-[hsl(var(--primary))] text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,122,255,0.2)] hover:brightness-110 active:brightness-95",
  secondary:
    "bg-white/80 text-[#1d1d1f] shadow-[0_0.5px_1px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-md hover:bg-white active:bg-[#f5f5f7]",
  ghost:
    "bg-transparent text-[#1d1d1f] hover:bg-black/[0.04] active:bg-black/[0.07]",
  danger:
    "bg-[hsl(var(--danger))] text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_8px_rgba(220,38,38,0.2)] hover:brightness-110 active:brightness-95",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-[36px] px-4 text-[14px]",
  sm: "h-[30px] px-3 text-[13px]",
  lg: "h-[44px] px-5 text-[15px]",
  icon: "h-[36px] w-[36px] p-0",
};

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className"> = {}) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  ),
);

Button.displayName = "Button";
