import { NextResponse } from "next/server";
import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { getProperty, readPropertyImage, removePropertyImage, setPropertyImage } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function detectMediaType(file: File): string {
  if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp") {
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return file.type || "application/octet-stream";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireApiContext();
    const property = getProperty(getDb(), ctx.workspace.id, id);
    if (!property) return apiError("Property not found.", 404, "not_found");
    const image = readPropertyImage(property);
    if (!image) return apiError("This property has no image.", 404, "not_found");
    return new NextResponse(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.mime,
        "Content-Length": String(image.bytes.length),
        "Cache-Control": "private, max-age=300",
      },
    });
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
    if (declaredLength > MAX_IMAGE_BYTES + 256 * 1024) {
      return apiError("The image must be 5 MB or smaller.", 413, "payload_too_large");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("Send the image as a form upload.", 400, "invalid_body");
    }
    const upload = form.get("image");
    if (!(upload instanceof File) || upload.size === 0) {
      return apiError("Choose an image to upload.", 422, "validation_error");
    }
    if (upload.size > MAX_IMAGE_BYTES) {
      return apiError("The image must be 5 MB or smaller.", 422, "validation_error");
    }
    const property = setPropertyImage(getDb(), {
      workspaceId: ctx.workspace.id,
      propertyId: id,
      file: {
        bytes: Buffer.from(await upload.arrayBuffer()),
        mediaType: detectMediaType(upload),
        filename: upload.name || "property-image",
      },
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, property }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const property = removePropertyImage(getDb(), {
      workspaceId: ctx.workspace.id,
      propertyId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, property });
  } catch (error) {
    return handleRouteError(error);
  }
}
