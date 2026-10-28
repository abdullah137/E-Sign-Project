import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { createApiKey, listApiKeys } from "@/lib/workspace-admin";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({ label: z.string().trim().min(2, "Give this key a label.").max(60) });

export async function GET() {
  try {
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can view API keys.", 403, "forbidden");
    }
    return apiOk({ keys: listApiKeys(getDb(), ctx.workspace.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can create API keys.", 403, "forbidden");
    }
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const result = createApiKey(getDb(), ctx.workspace.id, parsed.data.label);
    return apiOk({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
