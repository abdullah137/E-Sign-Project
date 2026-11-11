import type { ReactNode } from "react";
import { MarketingPageHeader } from "./page-header";

export function LegalPage({
  title,
  summary,
  updated = "29 October 2026",
  children,
}: {
  title: string;
  summary: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <>
      <MarketingPageHeader eyebrow="Legal" title={title} description={summary} />
      <div className="mx-auto w-full max-w-[840px] px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-brand-muted">
          Last updated {updated}
        </p>
        <div className="mt-8 space-y-10">{children}</div>
        <p className="mt-12 rounded border border-brand-200 bg-brand-50 px-4 py-3 text-[11.5px] leading-6 text-brand-700">
          This document is a working template for this deployment, not legal advice. The operator
          must have qualified counsel review and complete it, including the governing jurisdiction,
          before relying on it commercially.
        </p>
      </div>
    </>
  );
}

export function LegalSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-baseline gap-3 text-[19px] font-semibold tracking-[-0.01em] text-brand-ink">
        <span className="tabular text-[12px] font-semibold text-brand-500">{number}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[13px] leading-7 text-brand-muted">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
