import { NextResponse } from "next/server";
import { apiError, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/documents";
import { authenticateApiKey } from "@/lib/workspace-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerKey(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("x-api-key");
}

export async function GET(request: Request) {
  try {
    const raw = bearerKey(request);
    if (!raw) return apiError("Provide an API key in the Authorization header.", 401, "unauthorized");
    const auth = authenticateApiKey(getDb(), raw);
    if (!auth.scopes.includes("documents:read")) {
      return apiError("This API key does not have the documents:read scope.", 403, "forbidden");
    }
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 25);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const result = listDocuments(getDb(), auth.workspaceId, {
      status,
      limit: Number.isFinite(limit) ? limit : 25,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json(
      {
        data: result.items.map((doc) => ({
          id: doc.id,
          title: doc.title,
          status: doc.status.toLowerCase(),
          recipients: doc.recipient_count,
          signed: doc.signed_count,
          fields: doc.field_count,
          originalFilename: doc.original_filename,
          pageCount: doc.page_count,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          sentAt: doc.sent_at,
          completedAt: doc.completed_at,
          expiresAt: doc.expires_at,
        })),
        pagination: { total: result.total, limit, offset },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
