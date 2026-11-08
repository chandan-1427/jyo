import { describe, it, expect } from "vitest";
import { backgroundSettled, inBackground } from "./background.js";

const after = (ms: number, fn: () => void) => new Promise<void>((r) => setTimeout(() => (fn(), r()), ms));

describe("backgroundSettled", () => {
  it("waits for work started in the background, however long it takes", async () => {
    const done: string[] = [];
    inBackground(after(30, () => done.push("slow")));
    inBackground(after(5, () => done.push("fast")));

    await backgroundSettled();
    expect(done.sort()).toEqual(["fast", "slow"]);
  });

  it("also waits for work that background work starts", async () => {
    const done: string[] = [];
    inBackground(after(5, () => void inBackground(after(20, () => done.push("started later")))));

    await backgroundSettled();
    expect(done).toEqual(["started later"]);
  });

  it("isn't stopped by work that fails", async () => {
    inBackground(Promise.reject(new Error("push failed"))).catch(() => {});
    await expect(backgroundSettled()).resolves.toBeUndefined();
  });

  it("returns at once when nothing is running", async () => {
    await expect(backgroundSettled()).resolves.toBeUndefined();
  });
});
