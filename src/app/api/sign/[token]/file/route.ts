import { NextResponse } from "next/server";
import { apiError, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSigningContext } from "@/lib/documents";
import { readStoredObject } from "@/lib/storage";

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
    const file = lookup.context.file;
    const bytes = readStoredObject(file.storage_key);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
