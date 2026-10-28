import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSigningContext, saveSignatureAsset } from "@/lib/documents";
import { signatureAssetSchema } from "@/lib/validation";
import { ConflictError, ValidationError } from "@/lib/errors";
import { parseImageDataUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const db = getDb();
    const lookup = getSigningContext(db, token);
    if (!lookup.ok) {
      return apiError("This signing link is no longer valid.", 410, lookup.reason);
    }
    const { document, recipient } = lookup.context;
    if (document.status !== "PENDING") {
      throw new ConflictError("This document is no longer open for signing.");
    }
    if (recipient.status === "SIGNED") {
      throw new ConflictError("Your signature has already been recorded.");
    }
    if (!["OPENED", "CONSENTED"].includes(recipient.status)) {
      throw new ConflictError("Please accept the electronic signing consent first.");
    }
    const parsed = await parseJsonBody(request, signatureAssetSchema);
    if ("response" in parsed) return parsed.response;
    try {
      parseImageDataUrl(parsed.data.dataUrl);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : "Unsupported signature image.");
    }
    const asset = await saveSignatureAsset(db, {
      workspaceId: document.workspace_id,
      documentId: document.id,
      recipientId: recipient.id,
      dataUrl: parsed.data.dataUrl,
    });
    return apiOk({ ok: true, assetId: asset.assetId, mode: parsed.data.mode });
  } catch (error) {
    return handleRouteError(error);
  }
}
