import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "border border-[hsl(var(--primary))]/90 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_12px_24px_rgba(37,99,235,0.18)] hover:bg-[#2f6df6] hover:border-[#2f6df6]",
  secondary:
    "border border-[var(--tenant-border-color)] bg-white/88 text-[hsl(var(--secondary-foreground))] shadow-[0_8px_18px_rgba(15,23,42,0.04)] backdrop-blur-md hover:bg-white",
  ghost:
    "border border-transparent bg-transparent text-[hsl(var(--foreground))] hover:bg-white/70",
  danger:
    "border border-[hsl(var(--danger))] bg-[hsl(var(--danger))] text-white shadow-[0_12px_24px_rgba(220,38,38,0.14)] hover:bg-[#dc2626] hover:border-[#dc2626]",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-11 px-4.5 py-2 text-sm",
  sm: "h-9 px-3.5 text-sm",
  lg: "h-12 px-6.5 text-sm sm:text-base",
  icon: "h-11 w-11 p-0",
};

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className"> = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
