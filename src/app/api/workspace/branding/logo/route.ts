import { NextResponse } from "next/server";
import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { MAX_BRAND_LOGO_BYTES, parseBrandLogoUpload, readBrandLogo, removeBrandLogo, setBrandLogo } from "@/lib/brand-logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireApiContext();
    const logo = readBrandLogo(getDb(), ctx.workspace.id);
    if (!logo) return apiError("This workspace has no logo.", 404, "not_found");
    return new NextResponse(new Uint8Array(logo.bytes), {
      headers: {
        "Content-Type": logo.mediaType,
        "Content-Length": String(logo.bytes.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can change the logo.", 403, "forbidden");
    }
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_BRAND_LOGO_BYTES + 256 * 1024) {
      return apiError("The logo must be 1 MB or smaller.", 413, "payload_too_large");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("Send the logo as a form upload.", 400, "invalid_body");
    }
    const upload = form.get("logo");
    if (!(upload instanceof File) || upload.size === 0) {
      return apiError("Choose a logo to upload.", 422, "validation_error");
    }
    if (upload.size > MAX_BRAND_LOGO_BYTES) {
      return apiError("The logo must be 1 MB or smaller.", 422, "validation_error");
    }
    const logo = parseBrandLogoUpload({
      bytes: Buffer.from(await upload.arrayBuffer()),
      declaredType: upload.type,
    });
    const assetId = setBrandLogo(getDb(), ctx.workspace.id, logo);
    return apiOk({ ok: true, logoAssetId: assetId }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can change the logo.", 403, "forbidden");
    }
    removeBrandLogo(getDb(), ctx.workspace.id);
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
