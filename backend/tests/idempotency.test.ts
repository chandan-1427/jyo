import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, notifications, pickupRequests } from "../src/db/schema.js";
import { notifyPoster, sendPasswordResetEmail, sendVerificationEmail } from "../src/lib/mailer.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest, verifyEmail } from "./helpers/auth.js";

const app = createApp();

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

function newPost(cookie: string, extra: Record<string, unknown> = {}) {
  return authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
      ...extra,
    }),
  });
}

function askFor(cookie: string, postId: string) {
  return authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42 }),
  });
}

const postsBy = (posterId: string) => db.select().from(foodPosts).where(eq(foodPosts.posterId, posterId));

describe("posting the same form twice", () => {
  it("answers a repeated submission with the post it already made", async () => {
    const poster = await createVerifiedUser(app, { email: "repeat-post@example.com" });
    const clientKey = crypto.randomUUID();

    const first = await newPost(poster.cookie, { clientKey });
    expect(first.status).toBe(201);
    const again = await newPost(poster.cookie, { clientKey });
    expect(again.status).toBe(200);

    expect((await again.json()).post.id).toBe((await first.json()).post.id);
    expect(await postsBy(poster.userId)).toHaveLength(1);
  });

  it("makes one post when the same submission arrives twice at once", async () => {
    const poster = await createVerifiedUser(app, { email: "parallel-post@example.com" });
    const clientKey = crypto.randomUUID();

    const [a, b] = await Promise.all([newPost(poster.cookie, { clientKey }), newPost(poster.cookie, { clientKey })]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect((await a.json()).post.id).toBe((await b.json()).post.id);
    expect(await postsBy(poster.userId)).toHaveLength(1);
  });

  it("makes separate posts for separate submissions, and without a key", async () => {
    const poster = await createVerifiedUser(app, { email: "separate-posts@example.com" });

    await newPost(poster.cookie, { clientKey: crypto.randomUUID() });
    await newPost(poster.cookie, { clientKey: crypto.randomUUID() });
    await newPost(poster.cookie);
    await newPost(poster.cookie);

    expect(await postsBy(poster.userId)).toHaveLength(4);
  });

  it("never hands one person's post to another who sends the same key", async () => {
    const one = await createVerifiedUser(app, { email: "key-one@example.com" });
    const other = await createVerifiedUser(app, { email: "key-other@example.com" });
    const clientKey = crypto.randomUUID();

    const first = await (await newPost(one.cookie, { clientKey })).json();
    const second = await newPost(other.cookie, { clientKey });

    expect(second.status).toBe(201);
    expect((await second.json()).post.id).not.toBe(first.post.id);
  });

  it("rejects a key that isn't a UUID", async () => {
    const poster = await createVerifiedUser(app, { email: "bad-key@example.com" });
    expect((await newPost(poster.cookie, { clientKey: "abc" })).status).toBe(400);
  });
});

describe("asking for the same food twice", () => {
  it("answers a repeat with the request already made, not 'no longer available'", async () => {
    const poster = await createVerifiedUser(app, { email: "repeat-req-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "repeat-req-picker@example.com" });
    const post = (await (await newPost(poster.cookie)).json()).post;

    const first = await askFor(picker.cookie, post.id);
    expect(first.status).toBe(201);
    const again = await askFor(picker.cookie, post.id);
    expect(again.status).toBe(200);
    expect((await again.json()).request.id).toBe((await first.json()).request.id);

    const rows = await db.select().from(pickupRequests).where(eq(pickupRequests.postId, post.id));
    expect(rows).toHaveLength(1);

    await new Promise((r) => setTimeout(r, 100));
    const told = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, poster.userId), eq(notifications.type, "request_received")));
    expect(told).toHaveLength(1);
    expect(vi.mocked(notifyPoster)).toHaveBeenCalledTimes(1);
  });

  it("still tells someone else the food is taken", async () => {
    const poster = await createVerifiedUser(app, { email: "taken-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "taken-picker@example.com" });
    const late = await createVerifiedUser(app, { email: "taken-late@example.com" });
    const post = (await (await newPost(poster.cookie)).json()).post;

    await askFor(picker.cookie, post.id);
    const res = await askFor(late.cookie, post.id);
    expect(res.status).toBe(409);
  });

  it("lets a picker ask again after cancelling", async () => {
    const poster = await createVerifiedUser(app, { email: "reask-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "reask-picker@example.com" });
    const post = (await (await newPost(poster.cookie)).json()).post;

    const first = (await (await askFor(picker.cookie, post.id)).json()).request;
    await authedRequest(app, `/requests/${first.id}/cancel`, picker.cookie, { method: "POST" });

    const again = await askFor(picker.cookie, post.id);
    expect(again.status).toBe(201);
    expect((await again.json()).request.id).not.toBe(first.id);
  });
});

describe("email links used twice", () => {
  it("answers a verification link opened again with success", async () => {
    await postJson("/auth/register", {
      name: "Twice",
      email: "verify-twice@example.com",
      password: "password123",
      phone: "9876543210",
    });
    const [, token] = vi.mocked(sendVerificationEmail).mock.calls.at(-1)!;

    expect((await verifyEmail(app, token)).status).toBe(200);
    const again = await verifyEmail(app, token);
    expect(again.status).toBe(200);
    expect((await again.json()).message).toMatch(/already verified/);
  });

  it("sets the password once when a reset is submitted twice at once", async () => {
    const user = await createVerifiedUser(app, { email: "reset-twice@example.com" });
    await postJson("/auth/forgot-password", { email: user.email });
    const [, token] = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)!;

    const [a, b] = await Promise.all([
      postJson("/auth/reset-password", { token, password: "first-new-pass" }),
      postJson("/auth/reset-password", { token, password: "second-new-pass" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);

    const winner = a.status === 200 ? "first-new-pass" : "second-new-pass";
    const login = await postJson("/auth/login", { email: user.email, password: winner });
    expect(login.status).toBe(200);
  });
});
