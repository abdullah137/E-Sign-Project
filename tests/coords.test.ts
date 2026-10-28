import { describe, expect, it } from "vitest";
import {
  clampRect,
  displayPointToUser,
  displaySize,
  isValidRect,
  localAxes,
  normalizeRotation,
} from "@/lib/pdf/coords";

const rotations = [0, 90, 180, 270] as const;

describe("rotation normalization", () => {
  it("snaps arbitrary angles to the nearest quarter turn", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(89)).toBe(90);
    expect(normalizeRotation(181)).toBe(180);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(719)).toBe(0);
  });
});

describe("displaySize", () => {
  it("swaps width and height for quarter turns", () => {
    expect(displaySize(600, 800, 0)).toEqual({ width: 600, height: 800 });
    expect(displaySize(600, 800, 90)).toEqual({ width: 800, height: 600 });
    expect(displaySize(600, 800, 180)).toEqual({ width: 600, height: 800 });
    expect(displaySize(600, 800, 270)).toEqual({ width: 800, height: 600 });
  });
});

describe("displayPointToUser", () => {
  it("maps displayed coordinates to PDF user space for unrotated pages", () => {
    expect(displayPointToUser(0.25, 0.25, 600, 800, 0)).toEqual({ x: 150, y: 600 });
    expect(displayPointToUser(0, 0, 600, 800, 0)).toEqual({ x: 0, y: 800 });
    expect(displayPointToUser(1, 1, 600, 800, 0)).toEqual({ x: 600, y: 0 });
  });

  it("keeps points inside the page bounds for every rotation", () => {
    for (const rotation of rotations) {
      for (const [nx, ny] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [0.5, 0.5],
      ]) {
        const point = displayPointToUser(nx, ny, 600, 800, rotation);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(600);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(800);
      }
    }
  });

  it("maps the four display corners onto the four page corners", () => {
    for (const rotation of rotations) {
      const corners = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ].map(([nx, ny]) => displayPointToUser(nx, ny, 600, 800, rotation));
      const keys = new Set(corners.map((point) => `${point.x},${point.y}`));
      expect(keys).toEqual(new Set(["0,0", "600,0", "600,800", "0,800"]));
    }
  });
});

describe("localAxes", () => {
  it("returns orthonormal unit vectors for every rotation", () => {
    for (const rotation of rotations) {
      const { x, y } = localAxes(rotation);
      expect(Math.hypot(x.x, x.y)).toBeCloseTo(1);
      expect(Math.hypot(y.x, y.y)).toBeCloseTo(1);
      expect(x.x * y.x + x.y * y.y).toBeCloseTo(0);
    }
  });
});

describe("clampRect", () => {
  it("clamps negative offsets and overflowing sizes", () => {
    expect(clampRect({ x: -0.2, y: -0.1, width: 1.4, height: 1.2 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
    expect(clampRect({ x: 0.8, y: 0.9, width: 0.5, height: 0.5 })).toMatchObject({
      x: 0.8,
      y: 0.9,
    });
    const clamped = clampRect({ x: 0.8, y: 0.9, width: 0.5, height: 0.5 });
    expect(clamped.width).toBeCloseTo(0.2);
    expect(clamped.height).toBeCloseTo(0.1);
  });

  it("treats NaN as zero", () => {
    expect(clampRect({ x: Number.NaN, y: 0.2, width: 0.3, height: Number.NaN })).toEqual({
      x: 0,
      y: 0.2,
      width: 0.3,
      height: 0,
    });
  });
});

describe("isValidRect", () => {
  it("accepts a normalized rectangle inside the page", () => {
    expect(isValidRect({ x: 0.1, y: 0.1, width: 0.2, height: 0.05 })).toBe(true);
  });

  it("rejects degenerate, out-of-bounds and non-finite rectangles", () => {
    expect(isValidRect({ x: 0.1, y: 0.1, width: 0.001, height: 0.05 })).toBe(false);
    expect(isValidRect({ x: 0.1, y: 0.1, width: 0.2, height: 0 })).toBe(false);
    expect(isValidRect({ x: 0.9, y: 0.1, width: 0.2, height: 0.05 })).toBe(false);
    expect(isValidRect({ x: -0.1, y: 0.1, width: 0.2, height: 0.05 })).toBe(false);
    expect(isValidRect({ x: Number.NaN, y: 0, width: 0.2, height: 0.05 })).toBe(false);
    expect(isValidRect({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 0.05 })).toBe(false);
  });
});
