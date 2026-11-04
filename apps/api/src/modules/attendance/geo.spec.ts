import { haversineDistanceMeters } from "./geo";

describe("haversineDistanceMeters", () => {
  it("returns zero for the same coordinates", () => {
    expect(haversineDistanceMeters(-7.424, 109.23, -7.424, 109.23)).toBe(0);
  });

  it("calculates distance between distinct coordinates", () => {
    const distance = haversineDistanceMeters(0, 0, 0, 1);
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(112_000);
  });
});