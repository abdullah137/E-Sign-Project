import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Development outbox" };

export default async function DevOutboxPage() {
  if (!env.showDevOutbox) notFound();
  const db = getDb();
  const emails = db
    .prepare("SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT 60")
    .all() as unknown as Array<{
    id: string;
    kind: string;
    to_email: string;
    subject: string;
    status: string;
    created_at: string;
    body_text: string;
    payload_json: string;
  }>;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo href="/" />
          <div className="flex items-center gap-3">
            <Badge tone="gold">Development only</Badge>
            <a href="/auth/login" className="text-[13px] font-medium text-ink hover:underline">
              Sign in
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="overline mb-2">Local email capture</p>
        <h1 className="font-serif text-[36px] leading-[44px] text-ink">Outbox</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate">
          No SMTP server is configured, so transactional email is stored here. Links are fully
          functional in this environment. This page is disabled when{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[12px]">SHOW_DEV_OUTBOX=false</code>{" "}
          or in production.
        </p>

        <div className="mt-8 space-y-3">
          {emails.length === 0 ? (
            <div className="rounded-card border border-hairline bg-surface px-6 py-12 text-center text-[13px] text-slate">
              No e-mails have been queued yet.
            </div>
          ) : null}
          {emails.map((email) => {
            const payload = JSON.parse(email.payload_json || "{}") as {
              cta?: { label: string; url: string } | null;
            };
            return (
              <article key={email.id} className="rounded-card border border-hairline bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">{email.subject}</p>
                    <p className="mt-0.5 text-[12px] text-slate">
                      {email.to_email} · {email.kind} · {formatDateTime(email.created_at)}
                    </p>
                  </div>
                  <Badge tone={email.status === "failed" ? "danger" : email.status === "sent" ? "success" : "gold"}>
                    {email.status}
                  </Badge>
                </div>
                <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-hairline bg-surface-subtle px-3 py-2 text-[11.5px] leading-5 text-ink-secondary thin-scrollbar">
                  {email.body_text}
                </pre>
                {payload.cta?.url ? (
                  <a
                    href={payload.cta.url}
                    className="mt-3 inline-flex text-[12.5px] font-semibold text-gold-text hover:underline"
                  >
                    {payload.cta.label}: {payload.cta.url}
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
