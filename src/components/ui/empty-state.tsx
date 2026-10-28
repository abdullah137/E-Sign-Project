import { cn } from "@/lib/cn";
import Link from "next/link";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-hairline-strong bg-surface px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-slate">
          {icon}
        </div>
      ) : null}
      <h3 className="font-serif text-[22px] leading-7 text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13.5px] leading-6 text-slate">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function InlineEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-hairline-strong px-4 py-5">
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      {description ? <p className="text-[12.5px] leading-5 text-slate">{description}</p> : null}
      {action ? (
        <Link href={action.href} className="text-[12.5px] font-semibold text-gold-text hover:underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
