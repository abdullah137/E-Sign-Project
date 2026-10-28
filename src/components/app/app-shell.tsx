"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FilePlus2,
  Files,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  LogOut,
  Menu,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";

const primaryNav = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "New document", href: "/app/documents/new", icon: Upload },
  { label: "All documents", href: "/app/documents", icon: Files },
  { label: "Templates", href: "/app/templates", icon: LayoutTemplate },
  { label: "Public links", href: "/app/public-links", icon: Link2 },
];

const secondaryNav = [
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Help", href: "/app/help", icon: HelpCircle },
];

export interface ShellUser {
  name: string;
  email: string;
  role: string;
}

export interface ShellWorkspace {
  name: string;
  plan: string;
  planName: string;
}

export function AppShell({
  user,
  workspace,
  children,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/app/documents") {
      return pathname === href || (pathname.startsWith("/app/documents/") && !pathname.endsWith("/new"));
    }
    if (href === "/app/documents/new") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[248px] lg:flex-col lg:border-r lg:border-hairline lg:bg-surface">
        <SidebarContent pathname={pathname} workspace={workspace} isActive={isActive} />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-[rgba(18,20,23,0.34)]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-[286px] max-w-[86vw] flex-col border-r border-hairline bg-surface shadow-float">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded text-slate hover:bg-surface-subtle"
              aria-label="Close menu"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <SidebarContent pathname={pathname} workspace={workspace} isActive={isActive} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-hairline bg-[rgba(248,249,250,0.88)] backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-5 sm:px-8 lg:px-10">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded text-ink hover:bg-surface-subtle lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] text-slate">
                <span className="font-medium text-ink-secondary">{workspace.name}</span>
                <span className="mx-1.5 text-placeholder">/</span>
                <span>{sectionLabel(pathname)}</span>
              </p>
            </div>
            <Link
              href="/app/documents/new"
              className={buttonStyles("primary", "sm", "hidden sm:inline-flex")}
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              New document
            </Link>
            <AccountMenu user={user} planName={workspace.planName} />
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  workspace,
  isActive,
}: {
  pathname: string;
  workspace: ShellWorkspace;
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-6 pt-7">
        <Logo href="/app/dashboard" />
        <p className="mt-3 truncate text-[12px] leading-5 text-slate" title={workspace.name}>
          {workspace.name}
        </p>
      </div>
      <nav className="flex-1 px-3" aria-label="Primary">
        <ul className="space-y-0.5">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-[44px] items-center gap-3 rounded px-3 text-[13.5px] font-medium transition-colors",
                    active
                      ? "bg-surface-subtle text-ink"
                      : "text-slate hover:bg-surface-subtle hover:text-ink",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-gold" />
                  ) : null}
                  <item.icon
                    className={cn("h-[18px] w-[18px]", active ? "text-ink" : "text-[#7A808C]")}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-7 px-3">
          <p className="overline mb-2">Workspace</p>
        </div>
        <ul className="space-y-0.5">
          {secondaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-[42px] items-center gap-3 rounded px-3 text-[13px] transition-colors",
                    active ? "text-ink" : "text-slate hover:bg-surface-subtle hover:text-ink",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-gold" />
                  ) : null}
                  <item.icon className="h-[17px] w-[17px]" strokeWidth={1.75} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-hairline p-4">
        <div className="rounded-md border border-hairline bg-surface-subtle/70 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-overline text-slate">
              {workspace.planName} plan
            </p>
            {workspace.plan === "free" ? (
              <Badge tone="gold">Free</Badge>
            ) : (
              <Badge tone="success">Active</Badge>
            )}
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-slate">
            {workspace.plan === "free"
              ? "Upgrade for more documents and recipients."
              : "Your workspace entitlements are active."}
          </p>
          <Link
            href="/app/settings/billing"
            className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-gold-text hover:underline"
          >
            {workspace.plan === "free" ? "View plans" : "Manage plan"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function AccountMenu({ user, planName }: { user: ShellUser; planName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[42px] items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-surface-subtle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar name={user.name || user.email} />
        <ChevronDown className="hidden h-3.5 w-3.5 text-slate sm:block" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-card border border-hairline bg-surface shadow-float"
        >
          <div className="border-b border-hairline px-4 py-3.5">
            <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[12px] text-slate">{user.email}</p>
            <p className="mt-1 text-[11px] uppercase tracking-overline text-gold-text">
              {user.role} · {planName}
            </p>
          </div>
          <div className="p-1.5">
            <Link
              href="/app/settings"
              role="menuitem"
              className="flex min-h-[38px] items-center gap-2.5 rounded px-3 text-[13px] text-ink-secondary hover:bg-surface-subtle"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Account settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex min-h-[38px] w-full items-center gap-2.5 rounded px-3 text-left text-[13px] text-ink-secondary hover:bg-surface-subtle"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/app/dashboard")) return "Overview";
  if (pathname === "/app/documents/new") return "New document";
  if (pathname.startsWith("/app/documents/") && pathname.endsWith("/prepare")) return "Prepare";
  if (pathname.startsWith("/app/documents/") && pathname.endsWith("/send")) return "Review & send";
  if (pathname.startsWith("/app/documents/")) return "Document";
  if (pathname === "/app/documents") return "All documents";
  if (pathname.startsWith("/app/templates")) return "Templates";
  if (pathname.startsWith("/app/public-links")) return "Public links";
  if (pathname.startsWith("/app/settings/team")) return "Team";
  if (pathname.startsWith("/app/settings/billing")) return "Billing";
  if (pathname.startsWith("/app/settings/branding")) return "Branding";
  if (pathname.startsWith("/app/settings/developers")) return "Developers";
  if (pathname.startsWith("/app/settings")) return "Settings";
  if (pathname.startsWith("/app/help")) return "Help";
  return "Workspace";
}
