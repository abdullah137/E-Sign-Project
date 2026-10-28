import { cn } from "@/lib/cn";

export function Avatar({
  name,
  className,
  size = "md",
}: {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const sizes = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-[11px]", lg: "h-12 w-12 text-[13px]" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(184,149,88,0.35)] bg-warning-bg font-semibold tracking-wide text-gold-text",
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials || "SF"}
    </span>
  );
}
