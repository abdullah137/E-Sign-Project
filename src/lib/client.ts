export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code = "request_failed", details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function fieldLabel(field: string): string {
  const words = field
    .replace(/[._-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!words) return "This field";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function readableValidationMessage(message: string): string {
  if (/^required$/i.test(message)) return "is required";
  if (/invalid email/i.test(message)) return "enter a valid email address";
  const min = message.match(/at least (\d+) character/i);
  if (min) return `must be at least ${min[1]} characters`;
  const max = message.match(/at most (\d+) character/i);
  if (max) return `must be ${max[1]} characters or fewer`;
  if (/expected number, received string/i.test(message)) return "must be a number";
  if (/^invalid input$/i.test(message)) return "is not valid";
  return message;
}

function describeFieldErrors(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  const formErrors = (details as { formErrors?: unknown }).formErrors;
  const parts: string[] = [];
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const [field, value] of Object.entries(fieldErrors as Record<string, unknown>)) {
      const messages = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      const first = messages.find(
        (message): message is string => typeof message === "string" && message.trim().length > 0,
      );
      if (!first) continue;
      const message = first.trim();
      parts.push(
        /^[A-Z].*[.!]$/.test(message)
          ? message
          : `${fieldLabel(field)} ${readableValidationMessage(message)}`,
      );
    }
  }
  if (Array.isArray(formErrors)) {
    for (const message of formErrors) {
      if (typeof message === "string" && message.trim()) parts.push(message.trim());
    }
  }
  if (!parts.length) return null;
  return ` Please check: ${parts.slice(0, 3).join("; ").replace(/[.\s]+$/, "")}.`;
}

export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiClientError("The server returned an unexpected response.", response.status);
    }
  }
  if (!response.ok) {
    const errorPayload = payload as
      | { error?: { message?: string; code?: string; details?: unknown } }
      | null;
    const details = errorPayload?.error?.details;
    const summary = describeFieldErrors(details);
    const message = errorPayload?.error?.message || "Something went wrong. Please try again.";
    throw new ApiClientError(
      summary ? `${message}${summary}` : message,
      response.status,
      errorPayload?.error?.code,
      details,
    );
  }
  return payload as T;
}
