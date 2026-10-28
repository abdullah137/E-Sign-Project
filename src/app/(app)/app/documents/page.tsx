import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, FileText, Search } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  countDocumentsByStatus,
  expireStaleDocuments,
  listDocuments,
} from "@/lib/documents";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentTable } from "@/components/documents/document-table";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Documents" };

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "PENDING", label: "Pending" },
  { key: "COMPLETED", label: "Completed" },
  { key: "VOIDED", label: "Voided" },
  { key: "EXPIRED", label: "Expired" },
] as const;

const PAGE_SIZE = 20;

function buildHref(params: { status?: string; q?: string; page?: number }): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return `/app/documents${query ? `?${query}` : ""}`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const ctx = await requireWorkspace();
  const params = await searchParams;
  const db = getDb();
  expireStaleDocuments(db, ctx.workspace.id);
  const statusParam = STATUS_TABS.some((tab) => tab.key === params.status) ? params.status : "all";
  const q = (params.q || "").trim().slice(0, 120);
  const page = Math.max(1, Number(params.page) || 1);
  const counts = countDocumentsByStatus(db, ctx.workspace.id);
  const result = listDocuments(db, ctx.workspace.id, {
    status: statusParam,
    search: q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="All documents"
        title="Documents"
        description="Every agreement, every signature, one auditable record."
        actions={
          <Link href="/app/documents/new" className={buttonStyles("primary", "md")}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            New document
          </Link>
        }
      />

      <div className="mt-7 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            ariaLabel="Filter documents by status"
            items={STATUS_TABS.map((tab) => ({
              label: tab.label,
              href: buildHref({ status: tab.key, q }),
              count: tab.key === "all" ? counts.all : counts[tab.key] ?? 0,
              active: statusParam === tab.key,
            }))}
            className="flex-1"
          />
          <form action="/app/documents" method="get" className="relative w-full sm:w-64" role="search">
            {statusParam !== "all" ? <input type="hidden" name="status" value={statusParam} /> : null}
            <label htmlFor="document-search" className="sr-only">
              Search documents or recipients
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate"
              aria-hidden="true"
            />
            <input
              id="document-search"
              name="q"
              defaultValue={q}
              placeholder="Search title or recipient"
              className="h-10 w-full rounded border border-[rgba(18,20,23,0.12)] bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-placeholder focus:border-gold-text"
            />
          </form>
        </div>

        {q ? (
          <div className="flex items-center gap-2 text-[12.5px] text-slate">
            <span>
              {result.total} result{result.total === 1 ? "" : "s"} for “{q}”
            </span>
            <Link href={buildHref({ status: statusParam })} className="font-semibold text-gold-text hover:underline">
              Clear search
            </Link>
          </div>
        ) : null}

        {result.items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />}
            title={
              q
                ? "No documents match your search"
                : statusParam === "all"
                  ? "No documents yet"
                  : "Nothing in this view"
            }
            description={
              q
                ? "Try a different title, recipient name or email address."
                : statusParam === "all"
                  ? "Upload a PDF to begin your first signing request."
                  : "Documents move here as their status changes."
            }
            action={
              statusParam === "all" && !q ? (
                <Link href="/app/documents/new" className={buttonStyles("primary", "md")}>
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                  Upload a PDF
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <DocumentTable
              documents={result.items}
              actions={(document) => (
                <DocumentRowActions
                  document={{ id: document.id, title: document.title, status: document.status }}
                  canManage={
                    isAdmin(ctx.membership.role) || document.created_by === ctx.user.id
                  }
                />
              )}
            />

            <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
              <p className="text-[12px] text-slate">
                Showing{" "}
                <span className="tabular text-ink-secondary">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, result.total)}
                </span>{" "}
                of <span className="tabular text-ink-secondary">{result.total}</span> documents
              </p>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={buildHref({ status: statusParam, q, page: page - 1 })}
                      className={buttonStyles("secondary", "sm")}
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className={buttonStyles("secondary", "sm", "pointer-events-none opacity-45")}>
                      Previous
                    </span>
                  )}
                  <span className="tabular px-2 text-[12.5px] text-slate">
                    {page} / {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={buildHref({ status: statusParam, q, page: page + 1 })}
                      className={buttonStyles("secondary", "sm")}
                    >
                      Next
                    </Link>
                  ) : (
                    <span className={buttonStyles("secondary", "sm", "pointer-events-none opacity-45")}>
                      Next
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
