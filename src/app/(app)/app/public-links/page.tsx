import type { Metadata } from "next";
import { isAdmin, requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { listPublicLinks, listTemplates } from "@/lib/templates";
import { PageHeader } from "@/components/ui/page-header";
import { PublicLinksPanel } from "@/components/public-links/public-links-panel";

export const metadata: Metadata = { title: "Public links" };
export const dynamic = "force-dynamic";

export default async function PublicLinksPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const links = listPublicLinks(db, ctx.workspace.id);
  const templates = listTemplates(db, ctx.workspace.id)
    .filter((template) => template.recipientSlots.length === 1)
    .map((template) => ({
      id: template.id,
      name: template.name,
      fieldCount: template.fieldCount,
    }));

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Self-serve"
        title="Public links"
        description="Publish a single-recipient template that anyone can request after verifying their email."
      />
      <div className="mt-8">
        <PublicLinksPanel
          links={links}
          templates={templates}
          canManage={isAdmin(ctx.membership.role)}
          showDevOutbox={env.showDevOutbox}
        />
      </div>
    </div>
  );
}
