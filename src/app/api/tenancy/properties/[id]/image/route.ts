import { NextResponse } from "next/server";
import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import {
  addPropertyImages,
  getProperty,
  readPropertyImage,
  removePropertyImages,
} from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 12;

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireApiContext();
    const property = getProperty(getDb(), ctx.workspace.id, id);
    if (!property) return apiError("Property not found.", 404, "not_found");
    const imageId = new URL(request.url).searchParams.get("imageId");
    const image = readPropertyImage(getDb(), ctx.workspace.id, property.id, imageId);
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
    if (declaredLength > MAX_IMAGE_BYTES * MAX_IMAGES + 1024 * 1024) {
      return apiError("Each image must be 5 MB or smaller.", 413, "payload_too_large");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("Send the images as a form upload.", 400, "invalid_body");
    }
    const uploads = [...form.getAll("images"), ...form.getAll("image")].filter(
      (entry): entry is File => entry instanceof File && entry.size > 0,
    );
    if (uploads.length === 0) {
      return apiError("Choose at least one image to upload.", 422, "validation_error");
    }
    if (uploads.length > MAX_IMAGES) {
      return apiError(`Upload up to ${MAX_IMAGES} images at a time.`, 422, "validation_error");
    }
    if (uploads.some((upload) => upload.size > MAX_IMAGE_BYTES)) {
      return apiError("Each image must be 5 MB or smaller.", 422, "validation_error");
    }
    const images = addPropertyImages(getDb(), {
      workspaceId: ctx.workspace.id,
      propertyId: id,
      files: await Promise.all(
        uploads.map(async (upload) => ({
          bytes: Buffer.from(await upload.arrayBuffer()),
          mediaType: detectMediaType(upload),
          filename: upload.name || "property-image",
        })),
      ),
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, images }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const imageId = new URL(request.url).searchParams.get("imageId");
    const images = removePropertyImages(getDb(), {
      workspaceId: ctx.workspace.id,
      propertyId: id,
      imageId,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, images });
  } catch (error) {
    return handleRouteError(error);
  }
}
