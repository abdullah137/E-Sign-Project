import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { env } from "./env";
import { DomainError } from "./errors";

export function apiError(
  message: string,
  status = 400,
  code = "bad_request",
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: apiError("Request body must be valid JSON.", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: apiError("Please check the highlighted fields.", 422, "validation_error", {
        fieldErrors: parsed.error.flatten().fieldErrors,
        formErrors: parsed.error.flatten().formErrors,
      }),
    };
  }
  return { data: parsed.data };
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  const sameAsConfigured = origin === env.appUrl;
  const sameAsHost = host ? origin === `http://${host}` || origin === `https://${host}` : false;
  if (!sameAsConfigured && !sameAsHost) {
    throw new Error("Request origin is not allowed.");
  }
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return apiError("Please check the highlighted fields.", 422, "validation_error");
  }
  if (error instanceof DomainError) {
    return apiError(error.message, error.status, error.code, error.details);
  }
  if (error instanceof Error) {
    const message = error.message;
    const status =
      /permission|not allowed/i.test(message)
        ? 403
        : /not found/i.test(message)
          ? 404
          : /already|expired|voided|completed|no longer/i.test(message)
            ? 409
            : 400;
    return apiError(message, status);
  }
  console.error(error);
  return apiError("Something went wrong. Please try again.", 500, "server_error");
}
