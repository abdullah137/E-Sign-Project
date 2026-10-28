import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.02fr_1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-hairline bg-surface px-12 py-12 lg:flex xl:px-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gold" aria-hidden="true" />
          <Logo />
          <div className="max-w-[460px]">
            <p className="overline mb-5">Electronic signatures, considered</p>
            <h1 className="font-serif text-[52px] leading-[58px] tracking-[-0.02em] text-ink">
              Every agreement deserves a confident finish.
            </h1>
            <p className="mt-6 max-w-[420px] text-[15px] leading-7 text-slate">
              Prepare a PDF, place the right fields, and invite recipients to sign from any
              device. SignFlow keeps the document, the people and the evidence in one
              quiet workspace.
            </p>
            <div className="mt-10 space-y-5">
              {[
                ["Prepare", "Place signature, date and text fields precisely on every page."],
                ["Send", "Secure, expiring links mean recipients never need an account."],
                ["Prove", "A hash-linked activity record travels with every completed document."],
              ].map(([title, copy]) => (
                <div key={title} className="flex gap-4">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
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
            <span>Auditable activity</span>
            <span aria-hidden="true">·</span>
            <span>Built for clarity</span>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <div className="flex items-center justify-between px-5 py-6 sm:px-8 lg:hidden">
            <Logo />
            <Link href="/" className="text-[12.5px] text-slate hover:text-ink">
              Back to site
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8 lg:py-12">
            <div className="w-full max-w-[424px]">{children}</div>
          </div>
          <div className="px-5 pb-8 text-center text-[11px] leading-5 text-placeholder sm:px-8">
            SignFlow provides a record of signing activity. Legal effect depends on your
            jurisdiction and circumstances.
          </div>
        </main>
      </div>
    </div>
  );
}
