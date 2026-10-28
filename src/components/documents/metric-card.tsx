import { cn } from "@/lib/cn";

export function MetricCard({
  label,
  value,
  hint,
  icon,
  accent = "neutral",
  footer,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "neutral" | "gold" | "success";
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-overline text-slate">{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded",
              accent === "gold" && "bg-warning-bg text-gold-text",
              accent === "success" && "bg-success-bg text-success-text",
              accent === "neutral" && "bg-surface-subtle text-slate",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "tabular mt-4 font-serif text-[36px] leading-[42px] tracking-[-0.02em] sm:text-[40px] sm:leading-[46px]",
          accent === "gold" ? "text-gold-text" : accent === "success" ? "text-success-text" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12.5px] leading-5 text-slate">{hint}</p> : null}
      {footer ? <div className="mt-4 border-t border-hairline pt-3">{footer}</div> : null}
    </div>
  );
}
