import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebouncedValue", () => {
  it("passes a value on only once it has stopped changing", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "r" },
    });
    expect(result.current).toBe("r");

    rerender({ value: "ri" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "ric" });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("r");

    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("ric");
  });
});
