import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { SignJWT, decodeJwt } from "jose";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { revokedSessions } from "../src/db/schema.js";
import { SESSION_SECRET } from "../src/lib/session.js";
import { runRevokedSessionCleanup } from "../src/jobs/revokedSessionCleanup.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const me = (cookie: string) => app.request("/users/me", { headers: { cookie } });
const logout = (cookie?: string) => app.request("/auth/logout", { method: "POST", headers: cookie ? { cookie } : {} });

async function logIn(email: string) {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  return res.headers.get("set-cookie")!.split(";")[0];
}

describe("logging out", () => {
  it("ends that session on the server, so a copy of the cookie stops working", async () => {
    const user = await createVerifiedUser(app, { email: "leaving@example.com" });
    expect((await me(user.cookie)).status).toBe(200);

    const res = await logout(user.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/token=;.*Max-Age=0/);

    const afterwards = await me(user.cookie);
    expect(afterwards.status).toBe(401);
    expect((await afterwards.json()).error).toMatch(/session has ended/);
  });

  it("keeps the person's other devices logged in", async () => {
    const user = await createVerifiedUser(app, { email: "two-devices@example.com" });
    const phone = user.cookie;
    const laptop = await logIn(user.email);

    await logout(laptop);

    expect((await me(laptop)).status).toBe(401);
    expect((await me(phone)).status).toBe(200);
  });

  it("gives every session its own id", async () => {
    const user = await createVerifiedUser(app, { email: "ids@example.com" });
    const ids = [user.cookie, await logIn(user.email)].map((c) => decodeJwt(c.slice("token=".length)).jti);
    expect(ids[0]).toEqual(expect.any(String));
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("answers logging out twice, or with no session at all, the same way", async () => {
    const user = await createVerifiedUser(app, { email: "twice@example.com" });
    expect((await logout(user.cookie)).status).toBe(200);
    expect((await logout(user.cookie)).status).toBe(200);
    expect((await logout()).status).toBe(200);
    expect((await logout("token=not-a-token")).status).toBe(200);
    expect(await db.select().from(revokedSessions)).toHaveLength(1);
  });

  // Sessions from before ids existed can't be revoked one by one; they must
  // keep working (nobody is logged out by the deploy) and expire by themselves.
  it("still accepts a session issued before sessions had ids, and logs it out in the browser", async () => {
    const user = await createVerifiedUser(app, { email: "old-session@example.com" });
    const old = await new SignJWT({ userId: user.userId, ver: 0 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(SESSION_SECRET);

    expect((await me(`token=${old}`)).status).toBe(200);
    const res = await logout(`token=${old}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("forgets a logged-out session once its token would have expired anyway", async () => {
    const user = await createVerifiedUser(app, { email: "forget@example.com" });
    await logout(user.cookie);
    const [row] = await db.select().from(revokedSessions);

    expect(await runRevokedSessionCleanup(new Date(row.expiresAt.getTime() - 1000))).toHaveLength(0);
    expect(await runRevokedSessionCleanup(new Date(row.expiresAt.getTime() + 1000))).toHaveLength(1);
    expect(await db.select().from(revokedSessions)).toHaveLength(0);
  });
});
