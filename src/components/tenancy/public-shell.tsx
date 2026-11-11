import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export function PublicShell({
  workspaceName,
  children,
}: {
  workspaceName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline bg-card/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo href="/" />
          <span className="text-[11px] uppercase tracking-overline text-slate">{workspaceName}</span>
        </div>
      </header>
      {children}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-5 text-[11px] text-slate sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Juripass keeps inquiry details private and shares them only for this tenancy
            application. Juripass does not provide legal advice.
          </p>
          <Link href="/" className="hover:text-ink hover:underline">
            About Juripass
          </Link>
        </div>
      </footer>
    </div>
  );
}
