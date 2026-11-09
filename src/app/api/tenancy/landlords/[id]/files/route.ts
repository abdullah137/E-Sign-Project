import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { addLandlordFile, listLandlordFiles } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function detectMediaType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireApiContext();
    return apiOk({ files: listLandlordFiles(getDb(), id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_UPLOAD_BYTES + 256 * 1024) {
      return apiError("The document must be 5 MB or smaller.", 413, "payload_too_large");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("Send the document as a form upload.", 400, "invalid_body");
    }
    const upload = form.get("file");
    if (!(upload instanceof File) || upload.size === 0) {
      return apiError("Choose a document to upload.", 422, "validation_error");
    }
    if (upload.size > MAX_UPLOAD_BYTES) {
      return apiError("The document must be 5 MB or smaller.", 422, "validation_error");
    }
    const file = addLandlordFile(getDb(), {
      workspaceId: ctx.workspace.id,
      landlordId: id,
      file: {
        bytes: Buffer.from(await upload.arrayBuffer()),
        mediaType: detectMediaType(upload),
        filename: upload.name || "id-document",
      },
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, file }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
