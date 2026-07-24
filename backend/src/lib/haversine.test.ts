import { describe, it, expect } from "vitest";
import { haversineDistance, isWithinTirupati } from "./haversine.js";

describe("haversineDistance", () => {
  it("is zero for identical coordinates", () => {
    expect(haversineDistance(13.6288, 79.4192, 13.6288, 79.4192)).toBeCloseTo(0, 5);
  });

  it("computes a known real-world distance within a small margin", () => {
    // Tirupati to Chennai is ~110km by air
    const distance = haversineDistance(13.6288, 79.4192, 13.0827, 80.2707);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });

  it("is symmetric", () => {
    const a = haversineDistance(13.6288, 79.4192, 13.0827, 80.2707);
    const b = haversineDistance(13.0827, 80.2707, 13.6288, 79.4192);
    expect(a).toBeCloseTo(b, 10);
  });
});

describe("isWithinTirupati", () => {
  it("accepts the exact center point", () => {
    expect(isWithinTirupati(13.6288, 79.4192)).toBe(true);
  });

  it("accepts a point well inside the 20km radius", () => {
    expect(isWithinTirupati(13.65, 79.42)).toBe(true);
  });

  it("rejects a point far outside the radius (Chennai)", () => {
    expect(isWithinTirupati(13.0827, 80.2707)).toBe(false);
  });
});
