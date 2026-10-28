import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "accent" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-ink text-white border border-transparent hover:bg-[#24282F] disabled:hover:bg-ink",
  secondary:
    "bg-surface text-ink border border-[rgba(18,20,23,0.12)] hover:bg-surface-subtle",
  accent:
    "bg-gold text-white border border-transparent hover:bg-gold-hover disabled:hover:bg-gold",
  ghost:
    "bg-transparent text-slate border border-transparent hover:bg-surface-subtle hover:text-ink",
  danger:
    "bg-danger text-white border border-transparent hover:bg-[#9E1515] disabled:hover:bg-danger",
  subtle:
    "bg-surface-subtle text-ink border border-transparent hover:bg-surface-muted",
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
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded font-medium transition-colors duration-160 disabled:cursor-not-allowed disabled:opacity-50",
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
