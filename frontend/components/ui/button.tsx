import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--foreground))]",
  secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-white",
  ghost: "bg-transparent text-[hsl(var(--foreground))] hover:bg-white/70",
  danger: "bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--foreground))]",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-11 px-5 py-2.5",
  sm: "h-9 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11 p-0",
};

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className"> = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
