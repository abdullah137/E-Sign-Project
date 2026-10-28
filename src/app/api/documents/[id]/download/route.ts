import { NextResponse } from "next/server";
import { apiError, clientIp, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { appendAuditEvent } from "@/lib/audit";
import {
  ensureDocumentAccess,
  getCompletedDocumentData,
  getDocument,
  getDocumentDetail,
} from "@/lib/documents";
import { buildAuditCertificate } from "@/lib/pdf/certificate";
import { readStoredObject } from "@/lib/storage";
import { ConflictError } from "@/lib/errors";

export const runtime = "nodejs";

function disposition(name: string, download: boolean): string {
  const safe = name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "document.pdf";
  return `${download ? "attachment" : "inline"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireApiContext();
    const db = getDb();
    const doc = getDocument(db, id, ctx.workspace.id);
    if (!doc) return apiError("Document not found.", 404, "not_found");
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "view");

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") || "original";
    const download = url.searchParams.get("download") === "1";
    const actor = {
      id: ctx.user.id,
      label: ctx.user.full_name || ctx.user.email,
    };

    if (kind === "original") {
      const detail = getDocumentDetail(db, ctx.workspace.id, doc.id);
      if (!detail.originalFile) {
        return apiError("The original PDF is not available.", 404, "not_found");
      }
      const bytes = readStoredObject(detail.originalFile.storage_key);
      appendAuditEvent(db, {
        documentId: doc.id,
        workspaceId: doc.workspace_id,
        eventType: "document.downloaded",
        actorKind: "sender",
        actorId: actor.id,
        actorLabel: actor.label,
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { kind: "original", sha256: detail.originalFile.sha256 },
      });
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(bytes.length),
          "Content-Disposition": disposition(detail.originalFile.original_filename, download),
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (kind === "finalized") {
      if (doc.status !== "COMPLETED") {
        throw new ConflictError("The completed PDF is not available yet.");
      }
      const data = getCompletedDocumentData(db, doc.id);
      const bytes = readStoredObject(data.finalizedFile.storage_key);
      appendAuditEvent(db, {
        documentId: doc.id,
        workspaceId: doc.workspace_id,
        eventType: "document.downloaded",
        actorKind: "sender",
        actorId: actor.id,
        actorLabel: actor.label,
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { kind: "finalized", sha256: data.finalizedFile.sha256 },
      });
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(bytes.length),
          "Content-Disposition": disposition(data.finalizedFile.original_filename, download),
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (kind === "audit") {
      if (doc.status !== "COMPLETED") {
        throw new ConflictError("The audit certificate is available once the document is completed.");
      }
      const detail = getDocumentDetail(db, ctx.workspace.id, doc.id);
      appendAuditEvent(db, {
        documentId: doc.id,
        workspaceId: doc.workspace_id,
        eventType: "document.downloaded",
        actorKind: "sender",
        actorId: actor.id,
        actorLabel: actor.label,
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { kind: "audit" },
      });
      const data = getCompletedDocumentData(db, doc.id);
      const certificate = await buildAuditCertificate({
        documentTitle: data.document.title,
        documentId: data.document.id,
        workspaceName: detail.workspace.brand_display_name || detail.workspace.name,
        senderName: detail.creatorName,
        originalSha256: data.originalFile.sha256,
        completedSha256: data.finalizedFile.sha256,
        sentAt: data.document.sent_at,
        completedAt: data.document.completed_at,
        auditValid: data.auditValid,
        auditCount: data.events.length,
        recipients: data.recipients.map((recipient) => ({
          name: recipient.name,
          email: recipient.email,
          status: recipient.status,
          openedAt: recipient.opened_at,
          consentAt: recipient.consent_at,
          signedAt: recipient.signed_at,
        })),
        events: data.events.map((event) => ({
          at: event.at,
          eventType: event.event_type,
          actorKind: event.actor_kind,
          actorLabel: event.actor_label,
          metadata: JSON.parse(event.metadata_json || "{}"),
        })),
      });
      const base = data.document.title.replace(/\.pdf$/i, "");
      return new NextResponse(new Uint8Array(certificate), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(certificate.length),
          "Content-Disposition": disposition(`${base}-audit-certificate.pdf`, download),
          "Cache-Control": "private, no-store",
        },
      });
    }

    return apiError("Unknown download type.", 400, "bad_request");
  } catch (error) {
    return handleRouteError(error);
  }
}
