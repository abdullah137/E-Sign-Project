import { NextResponse } from "next/server";
import { apiError, clientIp, handleRouteError } from "@/lib/api";
import { appendAuditEvent } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { getSigningContext } from "@/lib/documents";
import { readStoredObject } from "@/lib/storage";
import { ConflictError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const db = getDb();
    const lookup = getSigningContext(db, token);
    if (!lookup.ok) {
      return apiError("This signing link is no longer valid.", 410, lookup.reason);
    }
    const { document, recipient, finalizedFile } = lookup.context;
    if (document.status !== "COMPLETED" || !finalizedFile) {
      throw new ConflictError("The completed PDF is not available yet.");
    }
    const bytes = readStoredObject(finalizedFile.storage_key);
    appendAuditEvent(db, {
      documentId: document.id,
      workspaceId: document.workspace_id,
      eventType: "document.downloaded",
      actorKind: "recipient",
      actorId: recipient.id,
      actorLabel: recipient.name || recipient.email,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { kind: "finalized", sha256: finalizedFile.sha256 },
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(finalizedFile.original_filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
