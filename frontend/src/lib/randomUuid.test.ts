import { describe, it, expect, vi } from "vitest";
import { randomUuid } from "./randomUuid";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomUuid", () => {
  it("makes version 4 UUIDs, a new one every time", () => {
    const ids = Array.from({ length: 2000 }, randomUuid);
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // crypto.randomUUID is missing on plain-http pages, like the phone preview
  // over the LAN.
  it("works where crypto.randomUUID doesn't exist", () => {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("randomUUID is not available here");
    });
    expect(randomUuid()).toMatch(UUID_V4);
  });
});
