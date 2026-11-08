import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const user = { id: "u1", name: "Ravi", email: "ravi@example.com", phone: "9876543210" };
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user }) }));

import { PhoneShareField } from "./PhoneShare";

function Harness() {
  const [checked, setChecked] = useState(false);
  return <PhoneShareField checked={checked} onChange={setChecked} label="Share my phone number" />;
}

function renderField() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
  return client;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PhoneShareField", () => {
  it("shows which number will be shared once the box is ticked", () => {
    renderField();
    expect(screen.queryByText("98765 43210")).toBeNull();

    fireEvent.click(screen.getByLabelText("Share my phone number"));

    expect(screen.getByText("98765 43210")).toBeTruthy();
  });

  it("refuses a malformed number without calling the API", () => {
    renderField();
    fireEvent.click(screen.getByLabelText("Share my phone number"));
    fireEvent.click(screen.getByRole("button", { name: "Change" }));

    fireEvent.change(screen.getByLabelText("Your phone number"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Enter a valid 10-digit phone number")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves a corrected number to the account", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: { ...user, phone: "9123456780" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = renderField();
    fireEvent.click(screen.getByLabelText("Share my phone number"));
    fireEvent.click(screen.getByRole("button", { name: "Change" }));

    fireEvent.change(screen.getByLabelText("Your phone number"), { target: { value: " 9123456780 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/users/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ phone: "9123456780" });
    await waitFor(() => expect(client.getQueryData(["auth", "me"])).toMatchObject({ phone: "9123456780" }));
  });
});
