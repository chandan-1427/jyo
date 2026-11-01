import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useLinkToken } from "./useLinkToken";

function renderAt(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(() => ({ token: useLinkToken(), location: useLocation() }), { wrapper });
}

describe("useLinkToken", () => {
  // The token opens the account, so it mustn't linger in the address bar,
  // history or anything that records the page's address.
  it("reads the token, then takes it out of the address", () => {
    const { result } = renderAt("/verify-email?token=abc123");

    expect(result.current.token).toBe("abc123");
    expect(result.current.location.pathname).toBe("/verify-email");
    expect(result.current.location.search).toBe("");
  });

  it("keeps the token after the address no longer has it", () => {
    const { result, rerender } = renderAt("/reset-password?token=def456");
    rerender();
    expect(result.current.token).toBe("def456");
  });

  it("is empty for a link without a token", () => {
    const { result } = renderAt("/verify-email");
    expect(result.current.token).toBeNull();
  });
});
