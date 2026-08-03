import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { users } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { resetDb } from "./helpers/db.js";
import { sendVerificationEmail } from "../src/lib/mailer.js";

const app = createApp();

function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validUser = {
  name: "Alice Example",
  email: "alice@example.com",
  password: "password123",
  phone: "9876543210",
};

async function registerAndCaptureToken(overrides: Partial<typeof validUser> = {}) {
  const payload = { ...validUser, ...overrides };
  await postJson("/auth/register", payload);
  const call = vi.mocked(sendVerificationEmail).mock.calls.at(-1);
  if (!call) throw new Error("sendVerificationEmail was never called");
  const [, token] = call;
  return { payload, token };
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("POST /auth/register", () => {
  it("creates a user and sends a verification email", async () => {
    const res = await postJson("/auth/register", validUser);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.user).toMatchObject({ name: validUser.name, email: validUser.email });
    expect(sendVerificationEmail).toHaveBeenCalledWith(validUser.email, expect.any(String));
  });

  it("rejects a duplicate email", async () => {
    await postJson("/auth/register", validUser);
    const res = await postJson("/auth/register", validUser);
    expect(res.status).toBe(400);
  });

  it("rejects invalid input with field errors", async () => {
    const res = await postJson("/auth/register", { ...validUser, email: "not-an-email" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.email).toBeTruthy();
  });

  it("rejects a re-registration while the original verification token is still live", async () => {
    await postJson("/auth/register", validUser);
    const res = await postJson("/auth/register", validUser);
    expect(res.status).toBe(400);
  });

  it("reclaims the email if the previous signup was never verified and its token expired", async () => {
    await postJson("/auth/register", validUser);
    await db
      .update(users)
      .set({ verificationTokenExpiry: new Date(Date.now() - 1000) })
      .where(eq(users.email, validUser.email));

    const res = await postJson("/auth/register", { ...validUser, name: "Alice Retry" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toMatchObject({ name: "Alice Retry", email: validUser.email });

    const [row] = await db.select().from(users).where(eq(users.email, validUser.email));
    expect(row.emailVerified).toBe(false);
    expect(row.verificationTokenExpiry!.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not reclaim an email that has since been verified", async () => {
    const { token } = await registerAndCaptureToken({ email: "reclaim-verified@example.com" });
    await app.request(`/auth/verify-email?token=${token}`);

    const res = await postJson("/auth/register", { ...validUser, email: "reclaim-verified@example.com" });
    expect(res.status).toBe(400);
  });
});

describe("GET /auth/verify-email", () => {
  it("verifies a valid token and allows login afterward", async () => {
    const { payload, token } = await registerAndCaptureToken();

    const verifyRes = await app.request(`/auth/verify-email?token=${token}`);
    expect(verifyRes.status).toBe(200);

    const loginRes = await postJson("/auth/login", {
      email: payload.email,
      password: payload.password,
    });
    expect(loginRes.status).toBe(200);
  });

  it("rejects an expired token", async () => {
    const { token } = await registerAndCaptureToken({ email: "expired@example.com" });

    await db
      .update(users)
      .set({ verificationTokenExpiry: new Date(Date.now() - 1000) })
      .where(eq(users.verificationToken, token));

    const res = await app.request(`/auth/verify-email?token=${token}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("rejects an unknown token", async () => {
    const res = await app.request("/auth/verify-email?token=not-a-real-token");
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("rejects login before the email is verified", async () => {
    const { payload } = await registerAndCaptureToken({ email: "unverified@example.com" });
    const res = await postJson("/auth/login", { email: payload.email, password: payload.password });
    expect(res.status).toBe(403);
  });

  it("rejects a wrong password with the same response as an unknown email", async () => {
    const { payload, token } = await registerAndCaptureToken({ email: "wrongpass@example.com" });
    await app.request(`/auth/verify-email?token=${token}`);

    const wrongPasswordRes = await postJson("/auth/login", {
      email: payload.email,
      password: "wrong-password",
    });
    const unknownEmailRes = await postJson("/auth/login", {
      email: "nobody@example.com",
      password: "whatever123",
    });

    expect(wrongPasswordRes.status).toBe(401);
    expect(unknownEmailRes.status).toBe(401);
    expect(await wrongPasswordRes.json()).toEqual(await unknownEmailRes.json());
  });

  it("logs in successfully with a verified account and sets a session cookie", async () => {
    const { payload, token } = await registerAndCaptureToken({ email: "verified@example.com" });
    await app.request(`/auth/verify-email?token=${token}`);

    const res = await postJson("/auth/login", { email: payload.email, password: payload.password });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^token=/);
  });
});
