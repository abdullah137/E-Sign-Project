import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashToken(token: string): string {
  return sha256Hex(`signflow:${token}`);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function addMinutesIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
