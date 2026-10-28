import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSigningContext, saveFieldValue } from "@/lib/documents";
import { fieldSubmissionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; fieldId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token, fieldId } = await params;
    const db = getDb();
    const lookup = getSigningContext(db, token);
    if (!lookup.ok) {
      return apiError("This signing link is no longer valid.", 410, lookup.reason);
    }
    const parsed = await parseJsonBody(request, fieldSubmissionSchema);
    if ("response" in parsed) return parsed.response;
    const result = saveFieldValue(db, token, fieldId, parsed.data, {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({
      ok: true,
      progress: result.progress,
      value: {
        fieldId: result.refreshed.field_id,
        valueText: result.refreshed.value_text,
        checked: result.refreshed.checked === 1,
        signatureAssetId: result.refreshed.signature_asset_id,
        signatureMode: result.refreshed.signature_mode,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
