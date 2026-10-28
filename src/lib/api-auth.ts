import { getWorkspaceContext, type WorkspaceContext } from "./auth";
import { DomainError } from "./errors";

export async function requireApiContext(): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    throw new DomainError("Sign in to continue.", "unauthorized", 401);
  }
  if (!ctx.user.email_verified_at) {
    throw new DomainError(
      "Verify your email address before using the workspace.",
      "email_unverified",
      403,
    );
  }
  return ctx;
}
