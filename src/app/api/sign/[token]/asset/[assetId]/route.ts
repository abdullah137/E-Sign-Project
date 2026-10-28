import { NextResponse } from "next/server";
import { apiError, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSigningContext } from "@/lib/documents";
import { readStoredObject, mediaTypeForKey } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; assetId: string }> },
) {
  try {
    const { token, assetId } = await params;
    const db = getDb();
    const lookup = getSigningContext(db, token);
    if (!lookup.ok) {
      return apiError("This signing link is no longer valid.", 410, lookup.reason);
    }
    const { document, recipient } = lookup.context;
    const asset = db
      .prepare(
        `SELECT a.storage_key, a.media_type
         FROM assets a
         JOIN field_values v ON v.signature_asset_id = a.id
         JOIN fields f ON f.id = v.field_id
         WHERE a.id = ? AND a.document_id = ? AND f.recipient_id = ?
         LIMIT 1`,
      )
      .get(assetId, document.id, recipient.id) as
      | { storage_key: string; media_type: string }
      | undefined;
    if (!asset) return apiError("Signature image not found.", 404, "not_found");
    const bytes = readStoredObject(asset.storage_key);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": asset.media_type || mediaTypeForKey(asset.storage_key),
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
