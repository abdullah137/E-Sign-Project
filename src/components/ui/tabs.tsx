import Link from "next/link";
import { cn } from "@/lib/cn";

export interface TabItem {
  label: string;
  href: string;
  count?: number;
  active?: boolean;
}

export function Tabs({ items, className, ariaLabel }: { items: TabItem[]; className?: string; ariaLabel?: string }) {
  return (
    <nav
      aria-label={ariaLabel ?? "Filters"}
      className={cn("-mx-1 flex gap-1 overflow-x-auto border-b border-hairline pb-0", className)}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex min-h-[42px] shrink-0 items-center gap-2 whitespace-nowrap px-3.5 pb-2 pt-2 text-[13px] font-medium transition-colors",
            item.active
              ? "text-ink after:absolute after:inset-x-2 after:bottom-[-1px] after:h-[2px] after:bg-gold"
              : "text-slate hover:text-ink",
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span
              className={cn(
                "tabular rounded-pill px-1.5 py-0.5 text-[10.5px] leading-4",
                item.active ? "bg-surface-muted text-ink-secondary" : "bg-surface-subtle text-slate",
              )}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
