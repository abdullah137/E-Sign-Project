import { apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { forwardToLandlord } from "@/lib/tenancy";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const result = forwardToLandlord(getDb(), {
      workspaceId: ctx.workspace.id,
      inquiryId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({
      ok: true,
      expiresAt: result.expiresAt,
      demoLink: env.showDevOutbox ? result.link : undefined,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
