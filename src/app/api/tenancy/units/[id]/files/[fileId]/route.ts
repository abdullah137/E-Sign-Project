import { NextResponse } from "next/server";
import { apiError, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { deleteUnitFile, getUnitFile, readUnitFile } from "@/lib/tenancy";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const { id, fileId } = await params;
    const ctx = await requireApiContext();
    const file = getUnitFile(getDb(), ctx.workspace.id, id, fileId);
    if (!file) return apiError("File not found.", 404, "not_found");
    const bytes = readUnitFile(file);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id, fileId } = await params;
    const ctx = await requireApiContext();
    deleteUnitFile(getDb(), { workspaceId: ctx.workspace.id, unitId: id, fileId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
