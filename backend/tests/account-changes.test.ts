import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { users } from "../src/db/schema.js";
import { sendPasswordResetEmail } from "../src/lib/mailer.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const postJson = (path: string, body: unknown) =>
  app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("editing your profile", () => {
  it("changes your name and phone, and the change sticks", async () => {
    const user = await createVerifiedUser(app, { email: "rename@example.com", name: "Old Name" });

    const res = await authedRequest(app, "/users/me", user.cookie, {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name", phone: "9123456789" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ name: "New Name", phone: "9123456789" });

    const me = await (await authedRequest(app, "/users/me", user.cookie)).json();
    expect(me.user).toMatchObject({ name: "New Name", phone: "9123456789" });
  });

  it("refuses a phone number that isn't 10 digits, changing nothing", async () => {
    const user = await createVerifiedUser(app, { email: "bad-phone@example.com", name: "Kept Name" });

    const res = await authedRequest(app, "/users/me", user.cookie, {
      method: "PATCH",
      body: JSON.stringify({ name: "Not Saved", phone: "12345" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).details.phone).toBeDefined();

    const me = await (await authedRequest(app, "/users/me", user.cookie)).json();
    expect(me.user.name).toBe("Kept Name");
  });
});

describe("password reset links", () => {
  it("refuses an expired link with a message saying to ask for a new one", async () => {
    const user = await createVerifiedUser(app, { email: "late-reset@example.com" });
    await postJson("/auth/forgot-password", { email: user.email });
    const [, token] = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)!;
    await db.update(users).set({ resetTokenExpiry: new Date(Date.now() - 1000) }).where(eq(users.id, user.userId));

    const res = await postJson("/auth/reset-password", { token, password: "a-new-password" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Reset link has expired. Please request a new one.");

    // The old password still works.
    expect((await postJson("/auth/login", { email: user.email, password: "password123" })).status).toBe(200);
  });
});
