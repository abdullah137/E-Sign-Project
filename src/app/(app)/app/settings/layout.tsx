import type { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata: Metadata = {
  title: { default: "Settings · SignFlow", template: "%s · SignFlow" },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-container py-8 sm:py-10">
      <div className="max-w-4xl">
        <p className="overline">Workspace</p>
        <h1 className="mt-2 font-serif text-[32px] leading-10 text-ink sm:text-[36px]">Settings</h1>
        <p className="mt-2 text-[13px] leading-6 text-slate">
          Manage your account, team, plan and workspace identity.
        </p>
        <div className="mt-7">
          <SettingsNav />
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
