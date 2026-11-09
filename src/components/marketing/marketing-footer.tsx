import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const columns = [
  {
    heading: "Resources",
    links: [
      { label: "Help centre", href: "/help" },
      { label: "Guides and articles", href: "/resources" },
      { label: "API documentation", href: "/api-docs" },
      { label: "Frequently asked questions", href: "/#faq" },
    ],
  },
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#solutions" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Create an account", href: "/auth/register" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
      { label: "Refund policy", href: "/legal/refund" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-hairline bg-card">
      <div className="mx-auto w-full max-w-page px-6 py-10">
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-[13px] leading-6 text-slate">
              Tenant inquiries, landlord decisions and signed tenancy agreements in one workspace
              for lawyers and rental agencies.
            </p>
            <p className="mt-4 text-[12px] text-slate">
              © {new Date().getFullYear()} Juripass. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-8">
            {columns.map((column) => (
              <div key={column.heading}>
                <p className="text-[13px] font-semibold text-ink">{column.heading}</p>
                <ul className="mt-2.5 space-y-1.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[13px] leading-6 text-slate transition-colors duration-150 hover:text-brand-600"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 max-w-2xl border-t border-hairline pt-5 text-[11.5px] leading-6 text-slate">
          Juripass provides tenancy workflow, document preparation and evidence tooling, not legal
          advice. Electronic-signature requirements vary by jurisdiction, industry and document type.
        </p>
      </div>
    </footer>
  );
}
