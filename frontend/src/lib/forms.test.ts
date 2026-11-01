import { describe, it, expect, vi } from "vitest";
import { applyServerFieldErrors } from "./forms";
import { ApiError } from "./api/api";

type Values = { title: string; description: string };

describe("applyServerFieldErrors", () => {
  it("shows each field's first message under that field", () => {
    const setError = vi.fn();
    const err = new ApiError("Invalid input", 400, { title: ["Too long", "Also bad"], description: ["Required"] });

    expect(applyServerFieldErrors<Values>(err, setError, ["title", "description"])).toBe(true);
    expect(setError).toHaveBeenCalledWith("title", { type: "server", message: "Too long" });
    expect(setError).toHaveBeenCalledWith("description", { type: "server", message: "Required" });
  });

  // A field the form doesn't have can't show an error, so the caller shows
  // the general message instead.
  it("ignores fields the form doesn't have, and says nothing matched", () => {
    const setError = vi.fn();
    const err = new ApiError("Invalid input", 400, { pickupLat: ["Must be a number"] });

    expect(applyServerFieldErrors<Values>(err, setError, ["title", "description"])).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("does nothing for an error without field details", () => {
    const setError = vi.fn();
    expect(applyServerFieldErrors<Values>(new ApiError("Server down", 500), setError, ["title"])).toBe(false);
    expect(applyServerFieldErrors<Values>(new Error("plain"), setError, ["title"])).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
