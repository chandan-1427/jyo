import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, ApiError } from "./api";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected apiFetch to fail");
}

describe("apiFetch", () => {
  it("returns the parsed body of a successful response", async () => {
    fetchMock.mockResolvedValue(json(200, { posts: [] }));
    expect(await apiFetch("/posts")).toEqual({ posts: [] });
  });

  it("calls the API with the session cookie and a JSON body type", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await apiFetch("/auth/login", { method: "POST", body: "{}", headers: { "X-Extra": "1" } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/auth/login");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(init!.headers).toEqual({ "Content-Type": "application/json", "X-Extra": "1" });
  });

  // The browser has to set a multipart body's own Content-Type, with its
  // boundary; setting JSON there would break every upload.
  it("leaves the content type of an upload to the browser", async () => {
    fetchMock.mockResolvedValue(json(201, { url: "u" }));
    await apiFetch("/posts/photos", { method: "POST", body: new FormData() });
    expect(fetchMock.mock.calls[0][1]!.headers).toEqual({});
  });

  it("throws the server's message, status and field details", async () => {
    fetchMock.mockResolvedValue(json(400, { error: "Invalid input", details: { title: ["Required"] } }));
    const err = await failure(apiFetch("/posts", { method: "POST", body: "{}" }));

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ message: "Invalid input", status: 400, details: { title: ["Required"] } });
  });

  it("says the server can't be reached when the device is offline", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await failure(apiFetch("/posts"));

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, message: expect.stringMatching(/Can't reach Jyo/) });
  });

  // What the host shows while a deploy starts: HTML, not JSON.
  it("gives a readable message for an error page that isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    expect(await failure(apiFetch("/posts"))).toMatchObject({ status: 502, message: expect.stringMatching(/having trouble/) });

    fetchMock.mockResolvedValue(new Response("<html>Too large</html>", { status: 413 }));
    expect(await failure(apiFetch("/posts"))).toMatchObject({ status: 413, message: "Something went wrong" });
  });

  it("treats a successful response without a JSON body as a failure", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    expect(await failure(apiFetch("/posts"))).toBeInstanceOf(ApiError);
  });

  // A cancelled request isn't an error to show the user.
  it("passes a cancellation through untouched", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));
    const err = await failure(apiFetch("/posts"));

    expect(err).not.toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ name: "AbortError" });
  });
});
