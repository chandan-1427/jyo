import { describe, it, expect } from "vitest";
import { returnPath } from "./returnPath";

describe("returnPath", () => {
  it("goes back to the page asked for", () => {
    expect(returnPath({ from: "/posts/abc" })).toBe("/posts/abc");
  });

  it("goes to the feed for anything that isn't a path in the app", () => {
    for (const state of [null, undefined, {}, { from: 42 }, { from: "https://evil.example" }, { from: "//evil.example" }, { from: "posts/abc" }]) {
      expect(returnPath(state)).toBe("/feed");
    }
  });
});
