import type { DatabaseSync } from "node:sqlite";
import { newId, nowIso } from "./ids";
import { deleteStoredObject, readStoredObject, saveBuffer } from "./storage";
import { ValidationError } from "./errors";

export const MAX_BRAND_LOGO_BYTES = 1024 * 1024;

export interface BrandLogoFile {
  bytes: Buffer;
  extension: "png" | "jpg";
  mediaType: "image/png" | "image/jpeg";
}

function sniffMediaType(bytes: Buffer): "image/png" | "image/jpeg" | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

function logoFile(bytes: Buffer): BrandLogoFile {
  if (bytes.length === 0) throw new ValidationError("The logo file is empty.");
  if (bytes.length > MAX_BRAND_LOGO_BYTES) {
    throw new ValidationError("The logo must be 1 MB or smaller.");
  }
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) throw new ValidationError("Upload the logo as a PNG or JPEG image.");
  return {
    bytes,
    mediaType,
    extension: mediaType === "image/png" ? "png" : "jpg",
  };
}

export function parseBrandLogoDataUrl(dataUrl: string): BrandLogoFile {
  const match = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new ValidationError("Upload the logo as a PNG or JPEG image.");
  return logoFile(Buffer.from(match[1], "base64"));
}

export function parseBrandLogoUpload(file: { bytes: Buffer; declaredType?: string }): BrandLogoFile {
  const detected = sniffMediaType(file.bytes);
  if (!detected) {
    throw new ValidationError("Upload the logo as a PNG or JPEG image.");
  }
  if (
    file.declaredType &&
    file.declaredType !== detected &&
    !(file.declaredType === "image/jpg" && detected === "image/jpeg")
  ) {
    throw new ValidationError("The logo file does not match its declared image type.");
  }
  return logoFile(file.bytes);
}

export function setBrandLogo(db: DatabaseSync, workspaceId: string, file: BrandLogoFile): string {
  const workspace = db
    .prepare("SELECT brand_logo_asset_id FROM workspaces WHERE id = ?")
    .get(workspaceId) as { brand_logo_asset_id: string | null } | undefined;
  if (!workspace) throw new ValidationError("Workspace not found.");
  const previous = workspace.brand_logo_asset_id
    ? (db
        .prepare("SELECT storage_key FROM assets WHERE id = ? AND workspace_id = ?")
        .get(workspace.brand_logo_asset_id, workspaceId) as { storage_key: string } | undefined)
    : undefined;
  const saved = saveBuffer(workspaceId, file.bytes, file.extension);
  const assetId = newId("ast");
  db.prepare(
    `INSERT INTO assets (id, workspace_id, document_id, kind, storage_key, media_type, bytes, sha256, created_at)
     VALUES (?, ?, NULL, 'brand_logo', ?, ?, ?, ?, ?)`,
  ).run(assetId, workspaceId, saved.storageKey, file.mediaType, saved.bytes, saved.sha256, nowIso());
  db.prepare("UPDATE workspaces SET brand_logo_asset_id = ? WHERE id = ?").run(assetId, workspaceId);
  if (previous) {
    db.prepare("DELETE FROM assets WHERE id = ?").run(workspace.brand_logo_asset_id);
    deleteStoredObject(previous.storage_key);
  }
  return assetId;
}

export function readBrandLogo(
  db: DatabaseSync,
  workspaceId: string,
): { bytes: Buffer; mediaType: string } | null {
  const row = db
    .prepare(
      `SELECT a.storage_key, a.media_type
       FROM workspaces w JOIN assets a ON a.id = w.brand_logo_asset_id
       WHERE w.id = ?`,
    )
    .get(workspaceId) as { storage_key: string; media_type: string } | undefined;
  if (!row) return null;
  try {
    return { bytes: readStoredObject(row.storage_key), mediaType: row.media_type };
  } catch {
    return null;
  }
}

export function removeBrandLogo(db: DatabaseSync, workspaceId: string): boolean {
  const row = db
    .prepare(
      `SELECT w.brand_logo_asset_id AS asset_id, a.storage_key
       FROM workspaces w LEFT JOIN assets a ON a.id = w.brand_logo_asset_id
       WHERE w.id = ?`,
    )
    .get(workspaceId) as { asset_id: string | null; storage_key: string | null } | undefined;
  if (!row?.asset_id) return false;
  db.prepare("UPDATE workspaces SET brand_logo_asset_id = NULL WHERE id = ?").run(workspaceId);
  db.prepare("DELETE FROM assets WHERE id = ?").run(row.asset_id);
  if (row.storage_key) deleteStoredObject(row.storage_key);
  return true;
}
