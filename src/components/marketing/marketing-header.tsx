"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const navigation = [
  { label: "Solutions", href: "/#solutions" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Help", href: "/help" },
  { label: "API docs", href: "/api-docs" },
  { label: "Resources", href: "/resources" },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <div className="mx-auto flex h-14 w-full max-w-nav items-center justify-between gap-6 rounded-[14px] border border-hairline bg-card/95 px-3 pl-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md">
        <Logo href="/" />

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-[13px] font-medium text-slate transition-colors duration-150 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/auth/login"
            className="text-[13px] font-medium text-slate transition-colors duration-150 hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex h-[34px] items-center justify-center rounded-lg bg-btn-dark px-3.5 text-[13px] font-semibold text-btn-dark-text transition-opacity duration-150 hover:opacity-90"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-hairline text-ink transition-colors hover:bg-surface-subtle lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="marketing-mobile-navigation"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        id="marketing-mobile-navigation"
        className={cn(
          "mx-auto mt-2 w-full max-w-nav rounded-[14px] border border-hairline bg-card shadow-float lg:hidden",
          menuOpen ? "block" : "hidden",
        )}
      >
        <nav aria-label="Mobile" className="px-4 pb-4 pt-2">
          <ul className="divide-y divide-hairline">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block py-3 text-[14px] font-medium text-ink"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/auth/register"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-btn-dark px-4 text-[14px] font-semibold text-btn-dark-text"
              onClick={() => setMenuOpen(false)}
            >
              Start free
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-hairline text-[14px] font-medium text-ink"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
