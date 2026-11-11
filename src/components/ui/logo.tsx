import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-sm", className)}
      aria-label="Juripass home"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/juripass-mark.png"
        alt=""
        width={300}
        height={300}
        className={cn("shrink-0 rounded-[7px]", compact ? "h-7 w-7" : "h-8 w-8")}
      />
      {!compact ? (
        <span className="text-[21px] font-bold leading-none tracking-[-0.02em] text-ink">
          Juripass
        </span>
      ) : null}
    </Link>
  );
}
