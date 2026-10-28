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
      aria-label="SignFlow home"
    >
      <svg
        width="26"
        height="30"
        viewBox="0 0 26 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M1 5.5C1 4.395 1.895 3.5 3 3.5H17.5L25 11V25.5C25 26.605 24.105 27.5 23 27.5H3C1.895 27.5 1 26.605 1 25.5V5.5Z"
          stroke="#121417"
          strokeWidth="1.4"
        />
        <path d="M17.5 3.5V11H25" stroke="#B89558" strokeWidth="1.4" />
        <path d="M6 18.5C8.2 15.7 10.1 15.7 12 18.5C13.9 21.3 15.8 21.3 18 18.5" stroke="#B89558" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {!compact ? (
        <span className="font-serif text-[22px] leading-none tracking-[-0.01em] text-ink">
          SignFlow
        </span>
      ) : null}
    </Link>
  );
}
