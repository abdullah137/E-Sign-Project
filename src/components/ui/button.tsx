import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "accent" | "ghost" | "danger" | "subtle" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white border border-transparent rounded-pill hover:bg-brand-700 hover:shadow-blue disabled:hover:bg-brand-600 disabled:hover:shadow-none",
  secondary:
    "bg-card text-ink border border-hairline-strong rounded-md hover:bg-surface-subtle",
  accent:
    "bg-brand-600 text-white border border-transparent rounded-pill hover:bg-brand-700 hover:shadow-blue disabled:hover:bg-brand-600 disabled:hover:shadow-none",
  dark: "bg-btn-dark text-btn-dark-text border border-transparent rounded-md hover:opacity-90",
  ghost:
    "bg-transparent text-slate border border-transparent rounded-md hover:bg-surface-subtle hover:text-ink",
  danger:
    "bg-danger text-white border border-transparent rounded-md hover:brightness-90 disabled:hover:brightness-100",
  subtle:
    "bg-surface-subtle text-ink border border-transparent rounded-md hover:bg-surface-muted",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-6 text-sm gap-2",
  lg: "h-12 px-7 text-[15px] gap-2",
  icon: "h-9 w-9 p-0 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function buttonStyles(variant: Variant = "primary", size: Size = "md", className = "") {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
