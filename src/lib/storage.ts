import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./env";
import { sha256Hex } from "./ids";

const storageRoot = path.join(env.dataDir, "storage");

export interface SavedObject {
  storageKey: string;
  sha256: string;
  bytes: number;
}

function safeExt(extension: string): string {
  const clean = extension.replace(/^\./, "").toLowerCase();
  if (!/^[a-z0-9]{1,6}$/.test(clean)) return "bin";
  return clean;
}

export function saveBuffer(workspaceId: string, buffer: Buffer, extension: string): SavedObject {
  const ext = safeExt(extension);
  const key = `${workspaceId}/${randomUUID()}.${ext}`;
  const fullPath = path.join(storageRoot, key);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer, { mode: 0o600 });
  return { storageKey: key, sha256: sha256Hex(buffer), bytes: buffer.length };
}

export function copyStoredObject(sourceKey: string, workspaceId: string): SavedObject {
  const buffer = readStoredObject(sourceKey);
  const ext = path.extname(sourceKey).replace(/^\./, "") || "bin";
  return saveBuffer(workspaceId, buffer, ext);
}

export function readStoredObject(storageKey: string): Buffer {
  const fullPath = resolveStoragePath(storageKey);
  return fs.readFileSync(fullPath);
}

export function storageExists(storageKey: string): boolean {
  try {
    return fs.existsSync(resolveStoragePath(storageKey));
  } catch {
    return false;
  }
}

export function resolveStoragePath(storageKey: string): string {
  const fullPath = path.resolve(storageRoot, storageKey);
  const relative = path.relative(storageRoot, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid storage key");
  }
  return fullPath;
}

export function deleteStoredObject(storageKey: string): void {
  try {
    fs.rmSync(resolveStoragePath(storageKey), { force: true });
  } catch {
    // Storage cleanup is best-effort.
  }
}

const IMAGE_TYPES: Record<string, { ext: string; mediaType: string }> = {
  "image/png": { ext: "png", mediaType: "image/png" },
  "image/jpeg": { ext: "jpg", mediaType: "image/jpeg" },
};

export function parseImageDataUrl(dataUrl: string): {
  buffer: Buffer;
  extension: string;
  mediaType: string;
} {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Unsupported signature image.");
  const mediaType = match[1];
  const type = IMAGE_TYPES[mediaType];
  if (!type) throw new Error("Unsupported signature image.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) throw new Error("Signature image is empty.");
  if (buffer.length > 1_500_000) throw new Error("Signature image is too large (1.5 MB max).");
  return { buffer, extension: type.ext, mediaType };
}

export function mediaTypeForKey(storageKey: string): string {
  const ext = path.extname(storageKey).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}
