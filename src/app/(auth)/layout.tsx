import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.02fr_1fr]">
        <aside className="hero-surface relative hidden flex-col justify-between overflow-hidden border-r border-hairline px-12 py-12 lg:sticky lg:top-0 lg:flex lg:h-screen xl:px-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-brand-600" aria-hidden="true" />
          <Logo />
          <div className="max-w-[460px]">
            <p className="mb-5 text-[12px] font-semibold uppercase tracking-overline text-brand-text">
              Tenancy management, signed
            </p>
            <h1 className="text-[46px] font-bold leading-[1.08] tracking-[-0.03em] text-ink">
              From tenant inquiry to signed agreement.
            </h1>
            <p className="mt-6 max-w-[420px] text-[15px] leading-7 text-ink-secondary">
              Screen prospective tenants, bring the landlord in without an account, and prepare
              agreements with an integrated signing workflow. Juripass keeps the property, the
              people and the evidence in one workspace.
            </p>
            <div className="mt-10 space-y-5">
              {[
                ["Screen", "A private inquiry form collects household, employment and guarantor details, with a secure card fee."],
                ["Approve", "Review the inquiry, then send it to the landlord with a decision link that expires automatically."],
                ["Sign", "Prepare the agreement and invite the tenant, guarantor and landlord in signing order."],
              ].map(([title, copy]) => (
                <div key={title} className="flex gap-4">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-6 text-slate">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6 text-[11px] leading-5 text-placeholder">
            <span>Private by default</span>
            <span aria-hidden="true">·</span>
            <span>Landlord review without accounts</span>
            <span aria-hidden="true">·</span>
            <span>Auditable signing</span>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <div className="flex items-center justify-between px-5 py-6 sm:px-8 lg:hidden">
            <Logo />
            <Link href="/" className="text-[12.5px] text-slate hover:text-ink">
              Back to site
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 [&:has(#hasLawFirm)]:items-start sm:px-8 lg:py-12">
            <div className="w-full max-w-[424px]">{children}</div>
          </div>
          <div className="px-5 pb-8 text-center text-[11px] leading-5 text-placeholder sm:px-8">
            Juripass provides workflow and evidence tooling for tenancy and signing. It does not
            provide legal advice; legal effect depends on your jurisdiction and circumstances.
          </div>
        </main>
      </div>
    </div>
  );
}
