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
import { verifyEmail } from "./helpers/auth.js";
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

  it("rejects a duplicate email as a conflict", async () => {
    await postJson("/auth/register", validUser);
    const res = await postJson("/auth/register", validUser);
    expect(res.status).toBe(409);
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
    expect(res.status).toBe(409);
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
    await verifyEmail(app, token);

    const res = await postJson("/auth/register", { ...validUser, email: "reclaim-verified@example.com" });
    expect(res.status).toBe(409);
  });
});

describe("POST /auth/verify-email", () => {
  it("verifies a valid token and allows login afterward", async () => {
    const { payload, token } = await registerAndCaptureToken();

    const verifyRes = await verifyEmail(app, token);
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

    const res = await verifyEmail(app, token);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("rejects an unknown token", async () => {
    const res = await verifyEmail(app, "not-a-real-token");
    expect(res.status).toBe(400);
  });

  it("rejects a missing token as bad input", async () => {
    const res = await postJson("/auth/verify-email", {});
    expect(res.status).toBe(400);
    expect((await res.json()).details.token).toBeTruthy();
  });

  // It changes the account, so it's a POST; the old GET is gone.
  it("is not reachable with GET", async () => {
    const { token } = await registerAndCaptureToken({ email: "get-verify@example.com" });
    const res = await app.request(`/auth/verify-email?token=${token}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /auth/resend-verification", () => {
  // The same answer whatever state the email is in, so it can't be used to
  // find out which emails have accounts.
  it("answers the same for an unknown, an unverified and a verified email", async () => {
    await registerAndCaptureToken({ email: "pending@example.com" });
    const { token } = await registerAndCaptureToken({ email: "done@example.com" });
    await verifyEmail(app, token);
    vi.clearAllMocks();

    const answers = [];
    for (const email of ["nobody@example.com", "pending@example.com", "done@example.com"]) {
      const res = await postJson("/auth/resend-verification", { email });
      answers.push({ status: res.status, body: await res.json() });
    }

    expect(answers[0].status).toBe(200);
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    // Only the account still waiting to be verified gets an email.
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledWith("pending@example.com", expect.any(String));
  });
});

describe("request bodies and unknown routes", () => {
  // Regression: a body that wasn't JSON threw inside the route and came back
  // as a reported 500.
  it("answers a malformed JSON body with a 400, not a 500", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid JSON/);
  });

  it("answers a missing body with a 400", async () => {
    const res = await app.request("/auth/register", { method: "POST" });
    expect(res.status).toBe(400);
  });

  it("answers an unknown route with a JSON 404", async () => {
    const res = await app.request("/no-such-route");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "Not found" });
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
    await verifyEmail(app, token);

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
    await verifyEmail(app, token);

    const res = await postJson("/auth/login", { email: payload.email, password: payload.password });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^token=/);
  });

  // Regression: accounts created before emails were lowercased can be stored
  // with capitals, while logins now always arrive lowercased. An exact-match
  // lookup locked those users out.
  it("logs in an account whose email was stored with capitals", async () => {
    const { payload, token } = await registerAndCaptureToken({ email: "legacy@example.com" });
    await verifyEmail(app, token);
    await db.update(users).set({ email: "Legacy@Example.com" }).where(eq(users.email, "legacy@example.com"));

    const res = await postJson("/auth/login", { email: "legacy@example.com", password: payload.password });
    expect(res.status).toBe(200);
  });

  it("treats the email as case-insensitive and ignores surrounding spaces", async () => {
    const { payload, token } = await registerAndCaptureToken({ email: "casey@example.com" });
    await verifyEmail(app, token);

    const res = await postJson("/auth/login", { email: "  Casey@Example.COM ", password: payload.password });
    expect(res.status).toBe(200);
  });
});

describe("input validation", () => {
  it("lowercases and trims the email on sign-up", async () => {
    const res = await postJson("/auth/register", { ...validUser, email: "  Mixed@Example.COM " });
    expect(res.status).toBe(201);
    const [row] = await db.select({ email: users.email }).from(users);
    expect(row.email).toBe("mixed@example.com");
  });

  it("does not allow a second account that differs only by letter case", async () => {
    await postJson("/auth/register", validUser);
    const res = await postJson("/auth/register", { ...validUser, email: validUser.email.toUpperCase() });
    expect(res.status).toBe(409);
  });

  it("rejects a phone number that is not exactly 10 digits", async () => {
    for (const phone of ["abcdefghij", "98765", "+919876543210", "98765 43210"]) {
      const res = await postJson("/auth/register", { ...validUser, phone });
      expect(res.status, `phone ${phone}`).toBe(400);
      const body = await res.json();
      expect(body.details.phone).toEqual(["Enter a valid 10-digit phone number"]);
    }
  });

  it("rejects a name that is only spaces around a single letter", async () => {
    const res = await postJson("/auth/register", { ...validUser, name: " a " });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.name).toEqual(["Name must be at least 2 characters"]);
  });
});
