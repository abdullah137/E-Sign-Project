import { z } from "zod";
import {
  apiError,
  apiOk,
  assertSameOrigin,
  clientIp,
  handleRouteError,
  parseJsonBody,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/ids";
import { rateLimit } from "@/lib/rate-limit";
import { submitInquiry, parsePassportPhotoDataUrl, type InquirySubmission } from "@/lib/tenancy";

export const runtime = "nodejs";

const submissionSchema = z.object({
  unitId: z.string().trim().max(80).optional().nullable(),
  currentAddress: z.string().trim().min(5, "Enter your current address.").max(400),
  currentCity: z.string().trim().max(120).optional().nullable(),
  currentState: z.string().trim().max(120).optional().nullable(),
  reasonForMoving: z.string().trim().max(600).optional().nullable(),
  maritalStatus: z.string().trim().max(60).optional().nullable(),
  childrenCount: z.coerce.number().int().min(0).max(20).default(0),
  employmentStatus: z.string().trim().max(80).optional().nullable(),
  employer: z.string().trim().max(160).optional().nullable(),
  occupation: z.string().trim().max(160).optional().nullable(),
  employmentAddress: z.string().trim().max(240).optional().nullable(),
  incomeRange: z.string().trim().max(80).optional().nullable(),
  religionState: z.string().trim().max(120).optional().nullable(),
  occupantsCount: z.coerce.number().int().min(0).max(30).optional().nullable(),
  dependentsCount: z.coerce.number().int().min(0).max(30).optional().nullable(),
  bedroomsRequired: z.coerce.number().int().min(0).max(20).optional().nullable(),
  stateOfOrigin: z.string().trim().max(120).optional().nullable(),
  additionalInfo: z.string().trim().max(1200).optional().nullable(),
  declarationAccepted: z.boolean().default(false),
  notes: z.string().trim().max(1200).optional().nullable(),
  signatureName: z.string().trim().min(2, "Type your full name to confirm the inquiry.").max(120),
  passportPhoto: z
    .union([
      z.literal(""),
      z
        .string()
        .max(2_900_000, "The passport photo must be 2 MB or smaller.")
        .regex(
          /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/,
          "Upload the passport photo as a PNG or JPEG image.",
        ),
    ])
    .optional(),
  guarantors: z
    .array(
      z.object({
        name: z.string().trim().max(120).optional().default(""),
        email: z.string().trim().max(254).optional().default(""),
        relationship: z.string().trim().max(60).optional().default(""),
      }),
    )
    .max(2)
    .default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const db = getDb();

    const ip = clientIp(request) ?? "unknown";
    const perIp = rateLimit(db, `public-inquiry:ip:${ip}`, 20, 60 * 60_000);
    if (!perIp.allowed) {
      return apiError("Too many submissions from this network. Try again later.", 429, "rate_limited");
    }
    const perToken = rateLimit(db, `public-inquiry:token:${hashToken(token)}`, 10, 60 * 60_000);
    if (!perToken.allowed) {
      return apiError(
        "Too many attempts for this inquiry. Wait a few minutes before trying again.",
        429,
        "rate_limited",
        { retryAfterSeconds: perToken.retryAfterSeconds },
      );
    }

    const parsed = await parseJsonBody(request, submissionSchema);
    if ("response" in parsed) return parsed.response;

    const { passportPhoto, ...submission } = parsed.data;
    const result = await submitInquiry(db, {
      rawToken: token,
      submission: submission as InquirySubmission,
      passportPhoto: passportPhoto ? parsePassportPhotoDataUrl(passportPhoto) : null,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true, inquiryId: result.inquiryId, payment: result.payment }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
