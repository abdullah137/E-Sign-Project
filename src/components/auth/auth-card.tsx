export function AuthCard({
  overline,
  title,
  description,
  children,
  footer,
}: {
  overline?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-6 shadow-float sm:p-8">
      {overline ? <p className="overline mb-2.5">{overline}</p> : null}
      <h1 className="font-serif text-[30px] leading-[38px] tracking-[-0.01em] text-ink">{title}</h1>
      {description ? <p className="mt-2 text-[13.5px] leading-6 text-slate">{description}</p> : null}
      <div className="mt-7">{children}</div>
      {footer ? <div className="mt-6 border-t border-hairline pt-5 text-[13px] text-slate">{footer}</div> : null}
    </div>
  );
}

export function AuthMessage({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const classes =
    tone === "error"
      ? "border-[rgba(186,26,26,0.18)] bg-[#FCF1F1] text-danger"
      : tone === "success"
        ? "border-[rgba(40,93,57,0.16)] bg-success-bg text-success-text"
        : "border-hairline bg-surface-subtle text-ink-secondary";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded border px-3.5 py-3 text-[13px] leading-5 ${classes}`}>
      {children}
    </div>
  );
}
