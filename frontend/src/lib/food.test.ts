import { describe, it, expect } from "vitest";
import { foodSummary, matchesDiet } from "./food";

describe("foodSummary", () => {
  it("reads as one short phrase", () => {
    expect(foodSummary({ diet: "veg", servings: 4 })).toBe("Veg, serves 4");
    expect(foodSummary({ diet: "non_veg", servings: 1 })).toBe("Non-veg, serves 1");
  });

  it("works with only one of the two", () => {
    expect(foodSummary({ diet: "egg", servings: null })).toBe("Egg");
    expect(foodSummary({ diet: null, servings: 3 })).toBe("Serves 3");
  });

  it("is null for posts made before the form asked", () => {
    expect(foodSummary({ diet: null, servings: null })).toBeNull();
    expect(foodSummary({})).toBeNull();
  });
});

describe("matchesDiet", () => {
  const veg = { diet: "veg" as const };
  const egg = { diet: "egg" as const };
  const nonVeg = { diet: "non_veg" as const };
  const unknown = { diet: null };

  it("shows everything under All", () => {
    for (const p of [veg, egg, nonVeg, unknown]) expect(matchesDiet(p, "all")).toBe(true);
  });

  it("shows only that diet under Veg, Egg or Non-veg", () => {
    expect([veg, egg, nonVeg, unknown].map((p) => matchesDiet(p, "veg"))).toEqual([true, false, false, false]);
    expect([veg, egg, nonVeg, unknown].map((p) => matchesDiet(p, "egg"))).toEqual([false, true, false, false]);
    expect([veg, egg, nonVeg, unknown].map((p) => matchesDiet(p, "non_veg"))).toEqual([false, false, true, false]);
  });
});
