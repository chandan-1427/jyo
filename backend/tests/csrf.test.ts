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

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// What a page on another website can make a logged-in visitor's browser
// send without a CORS preflight: a POST with a text/plain body (or none),
// with the session cookie attached.
function forged(path: string, cookie: string, headers: Record<string, string>) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "text/plain", cookie, ...headers },
    body: "{}",
  });
}

describe("requests from other websites", () => {
  it("refuses an action whose Origin is another website", async () => {
    const user = await createVerifiedUser(app, { email: "csrf-origin@example.com" });

    const res = await forged("/auth/demo/start", user.cookie, { Origin: "https://evil.example" });
    expect(res.status).toBe(403);

    const me = await (await app.request("/users/me", { headers: { cookie: user.cookie } })).json();
    expect(me.user.isDemo).toBe(false);
  });

  it("refuses an Origin of null (sandboxed frames, data: pages)", async () => {
    const user = await createVerifiedUser(app, { email: "csrf-null@example.com" });
    const res = await forged("/auth/demo/start", user.cookie, { Origin: "null" });
    expect(res.status).toBe(403);
  });

  it("refuses a browser request marked cross-site even without an Origin", async () => {
    const user = await createVerifiedUser(app, { email: "csrf-fetch-site@example.com" });
    const res = await forged("/auth/demo/start", user.cookie, { "Sec-Fetch-Site": "cross-site" });
    expect(res.status).toBe(403);
  });

  it("lets the app's own origins act, and reads through from anywhere", async () => {
    const user = await createVerifiedUser(app, { email: "csrf-allowed@example.com" });

    for (const origin of ["https://www.jyo.co.in", "https://jyo.co.in", "http://localhost:5173"]) {
      const res = await forged("/notifications/read-all", user.cookie, { Origin: origin });
      expect(res.status, origin).toBe(200);
    }

    // Reading is never refused here; CORS decides who may see the answer.
    const read = await app.request("/users/me", { headers: { cookie: user.cookie, Origin: "https://evil.example" } });
    expect(read.status).toBe(200);
  });

  it("sets the session cookie SameSite=Lax", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "x" }),
    });
    expect(res.status).toBe(401);

    const user = await createVerifiedUser(app, { email: "csrf-cookie@example.com" });
    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: "password123" }),
    });
    expect(login.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
  });
});
