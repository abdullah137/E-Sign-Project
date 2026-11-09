import type { ReactNode } from "react";

export function MarketingPageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="hero-surface border-b border-hairline">
      <div className="mx-auto w-full max-w-page px-6 pb-16 pt-20">
        <p className="text-[12px] font-semibold uppercase tracking-overline text-brand-700">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[46px]">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate">
          {description}
        </p>
        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </div>
  );
}
