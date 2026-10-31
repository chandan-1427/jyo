import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import crypto from "crypto";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { users } from "../src/db/schema.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../src/lib/mailer.js";
import { SESSION_SECRET } from "../src/lib/session.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest, verifyEmail } from "./helpers/auth.js";

const app = createApp();
const sha256 = (text: string) => crypto.createHash("sha256").update(text).digest("hex");

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

function postJson(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const signUp = (email: string, password: string) =>
  postJson("/auth/register", { name: "Ravi Kumar", email, password, phone: "9876543210" });

describe("email-link tokens are stored only as hashes", () => {
  // A copy of the database (a leaked backup) must hold nothing that opens
  // an account: the link carries the token, the row only its SHA-256.
  it("keeps the verification token's hash, and the emailed link still works", async () => {
    await signUp("hashed-verify@example.com", "password123");
    const [, token] = vi.mocked(sendVerificationEmail).mock.calls.at(-1)!;

    const [row] = await db.select().from(users).where(eq(users.email, "hashed-verify@example.com"));
    expect(row.verificationToken).not.toBe(token);
    expect(row.verificationToken).toBe(sha256(token));

    // The stored value itself doesn't verify anything.
    expect((await verifyEmail(app, row.verificationToken!)).status).toBe(400);
    expect((await verifyEmail(app, token)).status).toBe(200);
  });

  it("keeps the reset token's hash, and the emailed link still works", async () => {
    const user = await createVerifiedUser(app, { email: "hashed-reset@example.com" });
    await postJson("/auth/forgot-password", { email: user.email });
    const [, token] = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)!;

    const [row] = await db.select().from(users).where(eq(users.id, user.userId));
    expect(row.resetToken).toBe(sha256(token));

    expect((await postJson("/auth/reset-password", { token: row.resetToken, password: "another-pass" })).status).toBe(400);
    expect((await postJson("/auth/reset-password", { token, password: "another-pass" })).status).toBe(200);
  });

  it("keeps the hash of a resent verification token too", async () => {
    await signUp("hashed-resend@example.com", "password123");
    await postJson("/auth/resend-verification", { email: "hashed-resend@example.com" });
    const [, token] = vi.mocked(sendVerificationEmail).mock.calls.at(-1)!;

    const [row] = await db.select().from(users).where(eq(users.email, "hashed-resend@example.com"));
    expect(row.verificationToken).toBe(sha256(token));
  });
});

describe("session tokens", () => {
  it("refuses a token signed with any algorithm but HS256", async () => {
    const user = await createVerifiedUser(app, { email: "alg-pin@example.com" });
    const token = await new SignJWT({ userId: user.userId, ver: 0 })
      .setProtectedHeader({ alg: "HS512" })
      .setExpirationTime("7d")
      .sign(SESSION_SECRET);

    expect((await authedRequest(app, "/users/me", `token=${token}`)).status).toBe(401);
  });
});

describe("password length is limited in bytes", () => {
  // bcrypt ignores everything past a password's 72nd byte, so a longer one
  // would quietly be shorter than it looks.
  it("takes up to 72 bytes, in any script, and refuses more", async () => {
    expect((await signUp("bytes-72@example.com", "x".repeat(72))).status).toBe(201);
    expect((await signUp("bytes-73@example.com", "x".repeat(73))).status).toBe(400);

    // Telugu letters are 3 bytes each: 24 fit, 25 don't.
    expect((await signUp("telugu-24@example.com", "త".repeat(24))).status).toBe(201);
    const tooLong = await signUp("telugu-25@example.com", "త".repeat(25));
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).details.password).toEqual(["Password is too long"]);
  });
});
