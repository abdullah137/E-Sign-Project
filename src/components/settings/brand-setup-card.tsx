import Link from "next/link";
import { Check, Palette } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

export function BrandSetupCard({
  workspaceName,
  displayName,
  color,
  hasLogo,
  customBranding,
}: {
  workspaceName: string;
  displayName: string | null;
  color: string | null;
  hasLogo: boolean;
  customBranding: boolean;
}) {
  const items = [
    { label: "Firm logo", value: hasLogo ? "Uploaded" : "Not added", done: hasLogo },
    { label: "Display name", value: displayName || workspaceName, done: Boolean(displayName) },
    { label: "Accent colour", value: color ?? "Default", done: Boolean(color) },
  ];

  return (
    <section className="card p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
          <Palette className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Firm branding</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-slate">
            Your logo, display name and accent colour appear on inquiry pages, signing pages and agreement
            letterheads.
          </p>
        </div>
      </div>
      <ul className="mt-5 divide-y divide-hairline overflow-hidden rounded border border-hairline">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-4 bg-card px-4 py-2.5">
            <span className="text-[12.5px] text-slate">{item.label}</span>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
              {item.done ? <Check className="h-3.5 w-3.5 text-success-text" aria-hidden="true" /> : null}
              {item.value}
            </span>
          </li>
        ))}
      </ul>
      {!customBranding ? (
        <p className="mt-3 text-[11.5px] leading-5 text-slate">
          Display name and accent colour are included on Starter and Team. Your workspace name and logo can
          be updated now.
        </p>
      ) : null}
      <div className="mt-4">
        <Link href="/app/settings/branding" className={buttonStyles("secondary", "sm")}>
          Open branding settings
        </Link>
      </div>
    </section>
  );
}
