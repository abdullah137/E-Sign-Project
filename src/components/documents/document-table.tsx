import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { formatBytes, formatDate, relativeTime } from "@/lib/format";
import type { DocumentListRow } from "@/lib/documents";
import { cn } from "@/lib/cn";

export function documentHref(document: Pick<DocumentListRow, "id" | "status">): string {
  return document.status === "DRAFT"
    ? `/app/documents/${document.id}/prepare`
    : `/app/documents/${document.id}`;
}

export function recipientProgress(document: Pick<DocumentListRow, "recipient_count" | "signed_count" | "status">) {
  if (document.status === "DRAFT") {
    return document.recipient_count > 0 ? `${document.recipient_count} assigned` : "Not prepared";
  }
  return `${document.signed_count} of ${document.recipient_count} signed`;
}

export function DocumentTable({
  documents,
  compact = false,
  actions,
}: {
  documents: DocumentListRow[];
  compact?: boolean;
  actions?: (document: DocumentListRow) => React.ReactNode;
}) {
  return (
    <>
      <div className={cn("overflow-hidden rounded-card border border-hairline bg-surface", compact && "border-0")}>
        <table className="hidden w-full md:table">
          <caption className="sr-only">Documents</caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-overline text-slate">
                Document
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-overline text-slate">
                Recipients
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-overline text-slate">
                Updated
              </th>
              <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-overline text-slate">
                Status
              </th>
              <th scope="col" className="w-10 px-4 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id} className="group border-b border-hairline last:border-0 hover:bg-[#FAFBFC]">
                <td className="max-w-[360px] px-5 py-4">
                  <Link href={documentHref(document)} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-hairline bg-surface-subtle text-slate">
                      <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:text-ink">
                        {document.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-slate">
                        {document.original_filename ?? "PDF"} · {formatDate(document.created_at)}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-[13px] text-ink-secondary">
                  {recipientProgress(document)}
                </td>
                <td className="px-4 py-4 text-[13px] text-slate">{relativeTime(document.updated_at)}</td>
                <td className="px-4 py-4">
                  <StatusBadge status={document.status} />
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {actions ? actions(document) : null}
                    <Link
                      href={documentHref(document)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-slate hover:bg-surface-subtle hover:text-ink"
                      aria-label={`Open ${document.title}`}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {documents.map((document) => (
          <li key={document.id} className="rounded-card border border-hairline bg-surface p-4">
            <Link href={documentHref(document)} className="block transition-colors hover:opacity-90">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">{document.title}</p>
                  <p className="mt-1 text-[12px] text-slate">
                    {recipientProgress(document)} · {relativeTime(document.updated_at)}
                  </p>
                </div>
                <StatusBadge status={document.status} />
              </div>
            </Link>
            {actions ? (
              <div className="mt-3 flex items-center justify-end border-t border-hairline pt-2">
                {actions(document)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export function documentFileMeta(
  document: Pick<DocumentListRow, "page_count" | "file_bytes">,
): string {
  const parts: string[] = [];
  if (document.page_count) {
    parts.push(`${document.page_count} page${document.page_count === 1 ? "" : "s"}`);
  }
  if (document.file_bytes) parts.push(formatBytes(document.file_bytes));
  return parts.join(" · ");
}
