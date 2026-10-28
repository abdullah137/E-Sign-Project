import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "./ids";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  db: DatabaseSync,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const row = db.prepare("SELECT * FROM rate_limits WHERE key = ?").get(key) as
    | { key: string; count: number; reset_at: string }
    | undefined;

  if (!row || new Date(row.reset_at).getTime() <= now) {
    const resetAt = new Date(now + windowMs).toISOString();
    db.prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
    ).run(key, resetAt);
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (row.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - now) / 1000)),
    };
  }

  db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
  return {
    allowed: true,
    remaining: limit - row.count - 1,
    retryAfterSeconds: 0,
  };
}

export function clearRateLimit(db: DatabaseSync, key: string): void {
  db.prepare("DELETE FROM rate_limits WHERE key = ?").run(key);
}

export function pruneRateLimits(db: DatabaseSync): void {
  db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(nowIso());
}
