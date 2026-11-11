import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, KeyRound, Lock, Terminal } from "lucide-react";
import { MarketingPageHeader } from "@/components/marketing/page-header";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "API documentation",
  description:
    "Read-only REST API for listing Juripass workspace documents and their signing status with a scoped server key.",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded border border-brand-line bg-[#0F172A] p-4 font-mono text-[11.5px] leading-6 text-[#DBEAFE]">
      <code>{children}</code>
    </pre>
  );
}

const endpoint = `${env.appUrl}/api/v1/documents`;

export default function ApiDocsPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Developers"
        title="Read-only REST API"
        description="List workspace documents with status, recipient counts and timestamps. Tenancy agreements appear here as documents once they are prepared. The API is intentionally small: one read endpoint, scoped keys and no write access."
      >
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-brand-muted">
          <span className="rounded-sm bg-success-bg px-2 py-1 font-semibold text-success-text">
            GET only
          </span>
          <span className="rounded-sm border border-brand-line bg-white px-2 py-1">
            Scope: documents:read
          </span>
          <span className="rounded-sm border border-brand-line bg-white px-2 py-1">
            API access: Starter and Team
          </span>
        </div>
      </MarketingPageHeader>

      <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:gap-16">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand-muted">
            On this page
          </p>
          <nav aria-label="API documentation sections" className="mt-3 space-y-2 text-[12.5px]">
            {[
              ["Authentication", "#authentication"],
              ["List documents", "#list-documents"],
              ["Query parameters", "#query-parameters"],
              ["Response", "#response"],
              ["Errors", "#errors"],
              ["Availability", "#availability"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="block text-brand-muted transition-colors hover:text-brand-ink"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:underline"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Manage API keys
          </Link>
        </aside>

        <div className="min-w-0 space-y-12">
          <section id="authentication" className="scroll-mt-28">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-brand-ink">
              Authentication
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-brand-muted">
              Create a scoped key in <span className="font-medium text-brand-ink">Settings →
              Developers</span> as a workspace owner or admin. The full key is displayed once and
              only a SHA-256 hash is retained. Keys belong to a single workspace and carry the{" "}
              <code className="rounded bg-brand-50 px-1 py-0.5 font-mono text-[11.5px] text-brand-700">
                documents:read
              </code>{" "}
              scope.
            </p>
            <p className="mt-3 text-[13px] leading-6 text-brand-muted">
              Send the key as a bearer token or in the{" "}
              <code className="rounded bg-brand-50 px-1 py-0.5 font-mono text-[11.5px] text-brand-700">
                x-api-key
              </code>{" "}
              header. Revoked keys fail immediately. API access is available on Starter and Team;
              Free workspaces cannot create or use keys.
            </p>
            <CodeBlock>{`Authorization: Bearer jp_live_xxxxxxxxxxxxxxxxxxxxxxxx
# or
x-api-key: jp_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
            <p className="mt-3 flex items-start gap-2 rounded border border-brand-200 bg-brand-50 px-3.5 py-3 text-[12px] leading-6 text-brand-700">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Never embed a key in browser code or a public repository. Keys grant read access to
              every document in the workspace.
            </p>
          </section>

          <section id="list-documents" className="scroll-mt-28">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-success-bg px-2 py-1 font-mono text-[10.5px] font-bold text-success-text">
                GET
              </span>
              <code className="break-all font-mono text-[13px] font-medium text-brand-ink">
                /api/v1/documents
              </code>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-brand-muted">
              Returns documents in the authenticated workspace, newest activity first. Deleted
              documents are never returned.
            </p>
            <CodeBlock>{`curl -s "${endpoint}" \\
  -H "Authorization: Bearer $JURIPASS_API_KEY"`}</CodeBlock>
          </section>

          <section id="query-parameters" className="scroll-mt-28">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-brand-ink">
              Query parameters
            </h2>
            <div className="mt-4 overflow-hidden rounded border border-brand-line">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead className="bg-brand-wash text-[10.5px] uppercase tracking-[0.05em] text-brand-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Parameter</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line">
                  {[
                    [
                      "status",
                      "string",
                      "Optional. One of DRAFT, PENDING, FINALIZING, COMPLETED, VOIDED or EXPIRED. Matching is case-insensitive.",
                    ],
                    ["limit", "integer", "Optional. Page size from 1 to 100. Default 25."],
                    ["offset", "integer", "Optional. Zero-based offset. Default 0."],
                  ].map(([name, type, notes]) => (
                    <tr key={name} className="align-top">
                      <td className="px-4 py-3 font-mono text-[11.5px] text-brand-ink">{name}</td>
                      <td className="px-4 py-3 text-brand-muted">{type}</td>
                      <td className="px-4 py-3 leading-6 text-brand-muted">{notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="response" className="scroll-mt-28">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-brand-ink">Response</h2>
            <p className="mt-3 text-[13px] leading-6 text-brand-muted">
              A successful request returns <code className="font-mono text-[12px]">200</code> with a{" "}
              <code className="font-mono text-[12px]">data</code> array and pagination metadata.
              Timestamps are ISO 8601 UTC strings.
            </p>
            <CodeBlock>{`{
  "data": [
    {
      "id": "doc_9f2c1d",
      "title": "Residential tenancy — 12 Oak Street",
      "status": "pending",
      "recipients": 3,
      "signed": 2,
      "fields": 9,
      "originalFilename": "residential-tenancy.pdf",
      "pageCount": 8,
      "createdAt": "2026-10-27T08:42:11.000Z",
      "updatedAt": "2026-10-29T09:31:02.000Z",
      "sentAt": "2026-10-27T09:14:30.000Z",
      "completedAt": null,
      "expiresAt": "2026-11-10T09:14:30.000Z"
    }
  ],
  "pagination": { "total": 1, "limit": 25, "offset": 0 }
}`}</CodeBlock>
            <p className="mt-3 text-[12px] leading-6 text-brand-muted">
              Response headers include{" "}
              <code className="font-mono text-[11.5px]">Cache-Control: private, no-store</code>.
            </p>
          </section>

          <section id="errors" className="scroll-mt-28">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-brand-ink">Errors</h2>
            <p className="mt-3 text-[13px] leading-6 text-brand-muted">
              Errors use a consistent JSON shape with an HTTP status, a machine-readable code and a
              human-readable message.
            </p>
            <CodeBlock>{`{
  "error": {
    "code": "unauthorized",
    "message": "Provide an API key in the Authorization header."
  }
}`}</CodeBlock>
            <ul className="mt-4 space-y-2.5 text-[12.5px] leading-6 text-brand-muted">
              {[
                ["401 unauthorized", "The key is missing, malformed or revoked."],
                ["403 forbidden", "The key lacks documents:read or the workspace plan excludes API access."],
                ["400 bad_request", "The request could not be processed."],
              ].map(([code, meaning]) => (
                <li key={code} className="flex gap-3">
                  <code className="w-36 shrink-0 font-mono text-[11.5px] text-brand-ink">{code}</code>
                  <span>{meaning}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="availability" className="scroll-mt-28">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-brand-ink">
              Availability
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-card border border-brand-line bg-white p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
                  <Check className="h-4 w-4 text-success-text" aria-hidden="true" />
                  Available now
                </p>
                <ul className="mt-3 space-y-2 text-[12px] leading-5 text-brand-muted">
                  <li>Scoped API-key creation and revocation</li>
                  <li>GET /api/v1/documents</li>
                  <li>Status filtering and limit/offset pagination</li>
                </ul>
              </div>
              <div className="rounded-card border border-brand-line bg-white p-5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
                  <AlertTriangle className="h-4 w-4 text-warning-text" aria-hidden="true" />
                  Not available yet
                </p>
                <ul className="mt-3 space-y-2 text-[12px] leading-5 text-brand-muted">
                  <li>Write, send or delete endpoints</li>
                  <li>Webhooks and event subscriptions</li>
                  <li>OAuth applications</li>
                  <li>Monthly API document-send allowances</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-6 text-brand-muted">
              API access is not part of the Free plan. The Starter and Team API send allowances shown
              on the pricing page are catalogued but not implemented in this deployment.
            </p>
            <Link
              href="/resources#roadmap"
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
            >
              See the full roadmap
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </section>

          <p className="flex items-start gap-2 rounded border border-brand-line bg-brand-wash px-4 py-3 text-[11.5px] leading-6 text-brand-muted">
            <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Base URL shown here is this deployment&apos;s configured app URL. Use HTTPS in
            production and rotate any key that may have been exposed.
          </p>
        </div>
      </div>
    </>
  );
}
