export type Rotation = 0 | 90 | 180 | 270;

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeRotation(angle: number): Rotation {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return normalized as Rotation;
}

export function displaySize(
  pageWidth: number,
  pageHeight: number,
  rotation: Rotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: pageHeight, height: pageWidth }
    : { width: pageWidth, height: pageHeight };
}

/**
 * Converts a normalized point in displayed page space (origin top-left, rotation
 * applied as a PDF viewer would) into PDF user space (origin bottom-left).
 */
export function displayPointToUser(
  nx: number,
  ny: number,
  pageWidth: number,
  pageHeight: number,
  rotation: Rotation,
): { x: number; y: number } {
  const { width: dw, height: dh } = displaySize(pageWidth, pageHeight, rotation);
  const dx = nx * dw;
  const dy = ny * dh;
  switch (rotation) {
    case 90:
      return { x: dy, y: dx };
    case 180:
      return { x: pageWidth - dx, y: dy };
    case 270:
      return { x: pageWidth - dy, y: pageHeight - dx };
    case 0:
    default:
      return { x: dx, y: pageHeight - dy };
  }
}

/** Unit vectors for the overlay's local x (right) and y (up) axes in user space. */
export function localAxes(rotation: Rotation): {
  x: { x: number; y: number };
  y: { x: number; y: number };
} {
  switch (rotation) {
    case 90:
      return { x: { x: 0, y: 1 }, y: { x: -1, y: 0 } };
    case 180:
      return { x: { x: -1, y: 0 }, y: { x: 0, y: -1 } };
    case 270:
      return { x: { x: 0, y: -1 }, y: { x: 1, y: 0 } };
    case 0:
    default:
      return { x: { x: 1, y: 0 }, y: { x: 0, y: 1 } };
  }
}

export function clampRect(rect: NormalizedRect): NormalizedRect {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  const width = Math.min(clamp01(rect.width), 1 - x);
  const height = Math.min(clamp01(rect.height), 1 - y);
  return { x, y, width, height };
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function isValidRect(rect: NormalizedRect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0.002 &&
    rect.height > 0.002 &&
    rect.x + rect.width <= 1.0001 &&
    rect.y + rect.height <= 1.0001
  );
}
