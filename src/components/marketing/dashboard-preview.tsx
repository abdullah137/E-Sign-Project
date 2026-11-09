import { Check, Lock, Plus } from "lucide-react";

const sidebar = ["Dashboard", "Inquiries", "Properties", "Landlords", "Agreements", "Forms"];

export function DashboardPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[820px]">
      <span className="absolute -left-[18px] top-[90px] z-10 hidden h-11 w-11 items-center justify-center rounded-[14px] bg-brand-100 text-brand-700 shadow-[0_4px_12px_rgba(15,23,42,0.10)] sm:grid">
        <Check className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <span className="absolute -right-[14px] top-[170px] z-10 hidden h-11 w-11 items-center justify-center rounded-[14px] bg-brand-100 text-brand-700 shadow-[0_4px_12px_rgba(15,23,42,0.10)] sm:grid">
        <Lock className="h-5 w-5" strokeWidth={2} />
      </span>

      <div className="rounded-[24px] border border-hairline bg-card p-[18px] text-left shadow-float">
        <div className="mb-4 flex items-center gap-1.5">
          <span className="h-[9px] w-[9px] rounded-full bg-[#F87171]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#FBBF24]" />
          <span className="h-[9px] w-[9px] rounded-full bg-brand-500" />
          <span className="mx-auto rounded-md border border-hairline px-7 py-0.5 text-[10px] text-slate">
            app.juripass.test/app/dashboard
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[150px_minmax(0,1fr)]">
          <div className="hidden space-y-0.5 sm:block">
            {sidebar.map((item, index) => (
              <div
                key={item}
                className={
                  index === 0
                    ? "rounded-lg bg-brand-50 px-2.5 py-2 text-[12px] font-semibold text-brand-700"
                    : "rounded-lg px-2.5 py-2 text-[12px] text-slate"
                }
              >
                {item}
              </div>
            ))}
            <div className="mt-4 rounded-lg border border-hairline bg-surface p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate">
                Free plan
              </p>
              <p className="mt-1 text-[10px] leading-4 text-ink-secondary">
                Unlimited inquiries and documents
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex justify-end">
              <span className="inline-flex h-[30px] items-center gap-1 rounded-lg bg-brand-600 px-3.5 text-[11px] font-semibold text-white">
                <Plus className="h-3 w-3" />
                New inquiry
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ["Inquiries to review", "4"],
                ["Waiting on landlords", "3"],
                ["Agreements", "6"],
              ].map(([label, count]) => (
                <div
                  key={label}
                  className="rounded-xl border border-hairline bg-card p-3"
                >
                  <p className="text-[10.5px] font-medium text-ink-secondary">{label}</p>
                  <p className="mt-1 text-[20px] font-bold leading-none text-ink">{count}</p>
                  <div className="mt-2 h-2 w-3/5 rounded bg-surface-muted" />
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-hairline">
              <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
                <p className="text-[10px] font-semibold text-ink">Recent inquiries</p>
                <span className="text-[9px] text-slate">In sequence</span>
              </div>
              <div className="space-y-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  <div className="h-1.5 flex-1 rounded bg-surface-muted" />
                  <span className="text-[8.5px] text-slate">2m</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  <div className="h-1.5 w-4/5 rounded bg-surface-muted" />
                  <span className="text-[8.5px] text-slate">14m</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-text" />
                  <div className="h-1.5 w-2/3 rounded bg-surface-muted" />
                  <span className="text-[8.5px] text-slate">1h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
