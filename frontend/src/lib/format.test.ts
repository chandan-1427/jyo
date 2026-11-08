import { describe, it, expect } from "vitest";
import { formatAgo } from "./format";

describe("formatAgo", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const before = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("says just now for under a minute", () => {
    expect(formatAgo(before(30_000), now)).toBe("just now");
  });

  it("counts whole minutes under an hour", () => {
    expect(formatAgo(before(25 * 60_000 + 40_000), now)).toBe("25 min ago");
    expect(formatAgo(before(59 * 60_000), now)).toBe("59 min ago");
  });

  it("counts whole hours after that", () => {
    expect(formatAgo(before(60 * 60_000), now)).toBe("1 h ago");
    expect(formatAgo(before(150 * 60_000), now)).toBe("2 h ago");
  });

  // A phone clock running a little behind the server's.
  it("says just now for a time slightly in the future", () => {
    expect(formatAgo(new Date(now.getTime() + 20_000).toISOString(), now)).toBe("just now");
  });
});
