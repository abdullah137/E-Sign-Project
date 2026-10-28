import type { Metadata } from "next";
import { isAdmin, requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/documents";
import { listTemplates } from "@/lib/templates";
import { PageHeader } from "@/components/ui/page-header";
import { TemplatesPanel, type TemplateCandidate } from "@/components/templates/templates-panel";

export const metadata: Metadata = { title: "Templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const templates = listTemplates(db, ctx.workspace.id);
  const documents = listDocuments(db, ctx.workspace.id, { limit: 100 });
  const candidates: TemplateCandidate[] = documents.items
    .filter((doc) => doc.field_count > 0 && doc.recipient_count > 0)
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      status: doc.status,
      fieldCount: doc.field_count,
      recipientCount: doc.recipient_count,
    }));

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Reuse"
        title="Templates"
        description="Save a prepared layout once, then create consistent copies without rebuilding fields."
      />
      <div className="mt-8">
        <TemplatesPanel
          templates={templates}
          candidates={candidates}
          canManage={isAdmin(ctx.membership.role)}
        />
      </div>
    </div>
  );
}
