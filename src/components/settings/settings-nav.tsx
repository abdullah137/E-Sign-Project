"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  { label: "Profile", href: "/app/settings" },
  { label: "Team", href: "/app/settings/team" },
  { label: "Billing", href: "/app/settings/billing" },
  { label: "Branding", href: "/app/settings/branding" },
  { label: "Developers", href: "/app/settings/developers" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="border-b border-hairline">
      <ul className="-mb-px flex gap-5 overflow-x-auto">
        {tabs.map((tab) => {
          const active =
            tab.href === "/app/settings" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex border-b-2 px-0.5 pb-3 pt-1 text-[13px] font-medium transition-colors",
                  active
                    ? "border-gold text-ink"
                    : "border-transparent text-slate hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
