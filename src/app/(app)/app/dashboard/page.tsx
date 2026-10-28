import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FileText, FilePlus2, PenLine } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  expireStaleDocuments,
  getDashboardStats,
  listDocuments,
} from "@/lib/documents";
import { getPlan } from "@/lib/plans";
import { PageHeader } from "@/components/ui/page-header";
import { buttonStyles } from "@/components/ui/button";
import { MetricCard } from "@/components/documents/metric-card";
import { DocumentTable } from "@/components/documents/document-table";
import { EmptyState } from "@/components/ui/empty-state";
import { greeting } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  expireStaleDocuments(db, ctx.workspace.id);
  const stats = getDashboardStats(db, ctx.workspace.id);
  const recent = listDocuments(db, ctx.workspace.id, { limit: 6, offset: 0 });
  const plan = getPlan(ctx.workspace.plan);
  const firstName = (ctx.user.full_name || ctx.user.email).split(/\s+/)[0];
  const quotaRemaining = Math.max(0, plan.documentsPerMonth - stats.documentsThisMonth);

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Overview"
        title={`${greeting()}, ${firstName}`}
        description={
          stats.pending > 0
            ? `${stats.pending} document${stats.pending === 1 ? "" : "s"} awaiting signatures. You have ${quotaRemaining} of ${plan.documentsPerMonth} sends left this month.`
            : `Your workspace is up to date. You have ${quotaRemaining} of ${plan.documentsPerMonth} sends left this month.`
        }
        actions={
          <Link href="/app/documents/new" className={buttonStyles("primary", "md")}>
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            New document
          </Link>
        }
      />

      <section aria-label="Document summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Pending signatures"
          value={stats.pending}
          hint="Sent documents awaiting at least one signature"
          icon={<Clock3 className="h-4 w-4" strokeWidth={1.75} />}
          accent="gold"
          footer={
            <Link
              href="/app/documents?status=PENDING"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold-text hover:underline"
            >
              Review pending <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <MetricCard
          label="Completed"
          value={stats.completed}
          hint="Fully signed documents with an audit record"
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />}
          accent="success"
          footer={
            <Link
              href="/app/documents?status=COMPLETED"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-success-text hover:underline"
            >
              Open archive <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <MetricCard
          label="Drafts in progress"
          value={stats.drafts}
          hint="Unsent preparations, including autosaved field layouts"
          icon={<PenLine className="h-4 w-4" strokeWidth={1.75} />}
          footer={
            <Link
              href="/app/documents?status=DRAFT"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate hover:text-ink"
            >
              Continue preparing <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
      </section>

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="recent-heading" className="font-serif text-[24px] leading-8 text-ink">
              Recent documents
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate">The latest activity across your workspace.</p>
          </div>
          <Link
            href="/app/documents"
            className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-ink-secondary hover:text-ink sm:inline-flex"
          >
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recent.items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />}
            title="No documents yet"
            description="Upload a PDF, place fields for each recipient, and send a secure signing invitation."
            action={
              <Link href="/app/documents/new" className={buttonStyles("primary", "md")}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Upload a PDF
              </Link>
            }
          />
        ) : (
          <DocumentTable documents={recent.items} />
        )}

        <Link
          href="/app/documents"
          className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-secondary hover:text-ink sm:hidden"
        >
          View all documents <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </section>

      <section className="mt-10 rounded-card border border-hairline bg-surface p-5 sm:p-6" aria-label="Workspace usage">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="overline">This month</p>
            <p className="mt-1.5 text-[13.5px] text-ink-secondary">
              <span className="tabular font-semibold text-ink">{stats.documentsThisMonth}</span> of{" "}
              <span className="tabular">{plan.documentsPerMonth}</span> documents used on the {plan.name} plan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted" role="presentation">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${Math.min(100, Math.round((stats.documentsThisMonth / plan.documentsPerMonth) * 100))}%` }}
              />
            </div>
            <Link
              href="/app/settings/billing"
              className="text-[12.5px] font-semibold text-gold-text hover:underline"
            >
              {plan.id === "free" ? "Compare plans" : "Manage plan"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
