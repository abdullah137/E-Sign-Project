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
    throw new ApiClientError(
      errorPayload?.error?.message || "Something went wrong. Please try again.",
      response.status,
      errorPayload?.error?.code,
      errorPayload?.error?.details,
    );
  }
  return payload as T;
}
