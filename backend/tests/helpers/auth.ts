import { vi } from "vitest";
import type { Hono } from "hono";
import { sendVerificationEmail } from "../../src/lib/mailer.js";

let counter = 0;

// Registers, captures the verification token from the mocked mailer call,
// verifies, and logs in — returning the session cookie needed to call
// authenticated routes plus the user's id (read back via /users/me).
export async function createVerifiedUser(app: Hono, overrides: Partial<{ name: string; email: string; password: string; phone: string }> = {}) {
  counter += 1;
  const payload = {
    name: `Test User ${counter}`,
    email: `test-user-${counter}@example.com`,
    password: "password123",
    phone: "9876543210",
    ...overrides,
  };

  await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const call = vi.mocked(sendVerificationEmail).mock.calls.at(-1);
  if (!call) throw new Error("sendVerificationEmail was never called during test user setup");
  const [, token] = call;

  await app.request(`/auth/verify-email?token=${token}`);

  const loginRes = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  });

  const setCookie = loginRes.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login did not set a session cookie during test user setup");
  const cookie = setCookie.split(";")[0];

  const meRes = await app.request("/users/me", { headers: { cookie } });
  const me = await meRes.json();

  return { cookie, userId: me.user.id as string, email: payload.email };
}

export function authedRequest(app: Hono, path: string, cookie: string, init: RequestInit = {}) {
  return app.request(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie,
      ...init.headers,
    },
  });
}
