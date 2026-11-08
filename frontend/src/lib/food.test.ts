import { describe, it, expect } from "vitest";
import { foodSummary } from "./food";

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
