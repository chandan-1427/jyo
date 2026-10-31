import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser } from "./helpers/auth.js";

const app = createApp();

const UPLOAD_PATHS = ["/posts/photos", "/requests/selfies", "/users/me/avatar"];

beforeEach(async () => {
  await resetDb();
});

async function expectError(res: Response, status: number, error?: string) {
  expect(res.status).toBe(status);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  const body = await res.json();
  expect(typeof body.error).toBe("string");
  if (error) expect(body.error).toBe(error);
}

// A body without a Content-Length, as a client streaming it would send.
function streamed(bytes: Uint8Array) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("malformed uploads", () => {
  it("answers a multipart body without a boundary with 400, not a 500", async () => {
    const user = await createVerifiedUser(app, { email: "no-boundary@example.com" });
    for (const path of UPLOAD_PATHS) {
      const res = await app.request(path, {
        method: "POST",
        headers: { cookie: user.cookie, "Content-Type": "multipart/form-data" },
        body: "junk",
      });
      await expectError(res, 400, "Request body must be valid form data");
    }
  });

  it("answers a cut-off multipart body with 400", async () => {
    const user = await createVerifiedUser(app, { email: "cut-off@example.com" });
    const res = await app.request("/posts/photos", {
      method: "POST",
      headers: { cookie: user.cookie, "Content-Type": "multipart/form-data; boundary=x" },
      body: "--x\r\nContent-Disposition: form-data; name=\"file\"",
    });
    await expectError(res, 400, "Request body must be valid form data");
  });
});

describe("body size limits", () => {
  const bigJson = JSON.stringify({ email: "big@example.com", password: "x".repeat(100 * 1024) });

  it("refuses a JSON body over 64 KB with 413", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bigJson,
    });
    await expectError(res, 413, "Request body is too large");
  });

  it("refuses an oversized JSON body sent without a Content-Length", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: streamed(new TextEncoder().encode(bigJson)),
      // @ts-expect-error Node's fetch needs this for a streamed body.
      duplex: "half",
    });
    await expectError(res, 413, "Request body is too large");
  });

  it("refuses an upload over 6 MB with 413 on every upload path", async () => {
    const user = await createVerifiedUser(app, { email: "huge-upload@example.com" });
    for (const path of UPLOAD_PATHS) {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(7 * 1024 * 1024)]), "photo");
      const res = await app.request(path, { method: "POST", headers: { cookie: user.cookie }, body: form });
      await expectError(res, 413, "File is too large. Maximum size is 5MB.");
    }
  });

  it("lets an upload larger than the JSON limit through to the file checks", async () => {
    const user = await createVerifiedUser(app, { email: "mid-upload@example.com" });
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(1024 * 1024)]), "photo");
    const res = await app.request("/posts/photos", { method: "POST", headers: { cookie: user.cookie }, body: form });
    // Past the size limit: refused by the image-type check instead.
    await expectError(res, 400);
  });
});

describe("error responses", () => {
  it("asks a visitor without a session to log in", async () => {
    await expectError(await app.request("/users/me"), 401, "Please log in to continue.");
  });

  it("answers in JSON with an error message across the usual failures", async () => {
    const user = await createVerifiedUser(app, { email: "shapes@example.com" });
    const json = { "Content-Type": "application/json", cookie: user.cookie };

    await expectError(await app.request("/no-such-route"), 404);
    await expectError(await app.request("/posts/mine", { method: "PUT", headers: json }), 404);
    await expectError(await app.request("/posts/not-a-uuid", { headers: json }), 404);
    await expectError(await app.request("/posts", { method: "POST", headers: json, body: "{bad" }), 400);
    await expectError(await app.request("/posts?lat=abc&lng=1", { headers: json }), 400);
    await expectError(await app.request("/users/me", { headers: { cookie: "token=abc" } }), 401);
    await expectError(
      await app.request("/auth/logout", { method: "POST", headers: { Origin: "https://evil.example" } }),
      403
    );
  });
});
