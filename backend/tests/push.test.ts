import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: (name: string) => ({ data: { publicUrl: `https://storage.test/${name}` } }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({ setVapidDetails: vi.fn(), sendNotification }));

import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { pushSubscriptions, users } from "../src/db/schema.js";
import { sendPasswordResetEmail } from "../src/lib/mailer.js";
import { purgeAccount } from "../src/lib/domain/deleteAccount.js";
import { MAX_SUBSCRIPTIONS_PER_USER } from "../src/lib/notifications/push.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";
import { backgroundSettled } from "../src/lib/background.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  sendNotification.mockResolvedValue({ statusCode: 201 });
});

const fcm = (id: string) => `https://fcm.googleapis.com/fcm/send/${id}`;
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

const subscribe = (cookie: string, endpoint: string) =>
  authedRequest(app, "/push/subscriptions", cookie, { method: "POST", body: JSON.stringify({ endpoint, keys }) });
const subsOf = (userId: string) => db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
const settle = () => backgroundSettled();

async function requestFoodFrom(posterCookie: string, pickerCookie: string) {
  const post = await authedRequest(app, "/posts", posterCookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
      diet: "veg", servings: 2, cookedAt: new Date().toISOString(),
    }),
  });
  const postId = (await post.json()).post.id as string;
  await authedRequest(app, "/requests", pickerCookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Lakshmi Devi", etaMinutes: 15, lat: 13.63, lng: 79.42, sharePhone: true }),
  });
  await settle();
  return postId;
}

describe("subscribing a browser", () => {
  it("hands out the public key and saves a subscription", async () => {
    const user = await createVerifiedUser(app);

    const key = await (await authedRequest(app, "/push/public-key", user.cookie)).json();
    expect(key.publicKey).toBe(process.env.VAPID_PUBLIC_KEY);

    expect((await subscribe(user.cookie, fcm("a"))).status).toBe(201);
    expect(await subsOf(user.userId)).toHaveLength(1);
  });

  it("only accepts real push services, so the server can't be pointed anywhere else", async () => {
    const user = await createVerifiedUser(app);
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/a",
      "https://fcm.googleapis.com:8443/fcm/send/a",
      "https://fcm.googleapis.com.evil.example/a",
      "https://localhost/a",
      "https://169.254.169.254/latest",
      "https://user:pass@fcm.googleapis.com/a",
      "not a url",
    ]) {
      expect((await subscribe(user.cookie, endpoint)).status, endpoint).toBe(400);
    }
    for (const endpoint of [
      fcm("b"),
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/QGx",
      "https://wns2-sg2p.notify.windows.com/w/?token=x",
    ]) {
      expect((await subscribe(user.cookie, endpoint)).status, endpoint).toBe(201);
    }
    expect((await subsOf(user.userId)).map((s) => s.endpoint)).not.toContain("https://localhost/a");
  });

  it("moves a browser's subscription to whoever signs in on it next", async () => {
    const first = await createVerifiedUser(app);
    const second = await createVerifiedUser(app);
    await subscribe(first.cookie, fcm("shared"));
    await subscribe(second.cookie, fcm("shared"));

    expect(await subsOf(first.userId)).toHaveLength(0);
    expect(await subsOf(second.userId)).toHaveLength(1);
  });

  it(`keeps only the newest ${MAX_SUBSCRIPTIONS_PER_USER} browsers per person`, async () => {
    const user = await createVerifiedUser(app);
    for (let i = 0; i <= MAX_SUBSCRIPTIONS_PER_USER; i++) await subscribe(user.cookie, fcm(`d${i}`));

    const left = (await subsOf(user.userId)).map((s) => s.endpoint);
    expect(left).toHaveLength(MAX_SUBSCRIPTIONS_PER_USER);
    expect(left).not.toContain(fcm("d0"));
  });

  it("unsubscribes only the caller's own browser", async () => {
    const owner = await createVerifiedUser(app);
    const other = await createVerifiedUser(app);
    await subscribe(owner.cookie, fcm("mine"));

    await authedRequest(app, "/push/unsubscribe", other.cookie, { method: "POST", body: JSON.stringify({ endpoint: fcm("mine") }) });
    expect(await subsOf(owner.userId)).toHaveLength(1);

    const res = await authedRequest(app, "/push/unsubscribe", owner.cookie, { method: "POST", body: JSON.stringify({ endpoint: fcm("mine") }) });
    expect(res.status).toBe(200);
    expect(await subsOf(owner.userId)).toHaveLength(0);
  });

  it("needs a logged-in user", async () => {
    const res = await app.request("/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: fcm("x"), keys }),
    });
    expect(res.status).toBe(401);
  });
});

describe("sending", () => {
  it("pushes each notification to the person's browsers, with nothing identifying on it", async () => {
    const poster = await createVerifiedUser(app, { phone: "9000000001" });
    const picker = await createVerifiedUser(app, { phone: "9000000002" });
    await subscribe(poster.cookie, fcm("poster-phone"));

    const postId = await requestFoodFrom(poster.cookie, picker.cookie);

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [target, payload] = sendNotification.mock.calls[0];
    expect(target.endpoint).toBe(fcm("poster-phone"));
    const message = JSON.parse(payload);
    expect(message.url).toBe(`/posts/${postId}`);
    expect(message.body).toMatch(/wants to pick up your food/);
    expect(payload).not.toContain("Lakshmi");
    expect(payload).not.toContain("9000000002");
  });

  it("forgets a subscription the push service says is gone, and keeps one that failed for another reason", async () => {
    const poster = await createVerifiedUser(app);
    const picker = await createVerifiedUser(app);
    await subscribe(poster.cookie, fcm("expired"));
    await subscribe(poster.cookie, fcm("flaky"));
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      throw Object.assign(new Error("push failed"), { statusCode: sub.endpoint.endsWith("expired") ? 410 : 500 });
    });

    await requestFoodFrom(poster.cookie, picker.cookie);

    expect((await subsOf(poster.userId)).map((s) => s.endpoint)).toEqual([fcm("flaky")]);
  });
});

describe("ending subscriptions with the account", () => {
  it("removes every browser when the password is reset", async () => {
    const user = await createVerifiedUser(app);
    await subscribe(user.cookie, fcm("r1"));
    await subscribe(user.cookie, fcm("r2"));

    await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email }),
    });
    const [, token] = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)!;
    const res = await app.request("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "a-new-password" }),
    });
    expect(res.status).toBe(200);
    expect(await subsOf(user.userId)).toHaveLength(0);
  });

  it("removes them when the account is deleted, and the later erase still works", async () => {
    const user = await createVerifiedUser(app);
    await subscribe(user.cookie, fcm("del"));

    const res = await authedRequest(app, "/users/me", user.cookie, {
      method: "DELETE",
      body: JSON.stringify({ password: "password123" }),
    });
    expect(res.status).toBe(200);
    expect(await subsOf(user.userId)).toHaveLength(0);

    await db.insert(pushSubscriptions).values({ userId: user.userId, endpoint: fcm("late"), ...keys });
    await purgeAccount(user.userId);
    expect(await db.select().from(users).where(eq(users.id, user.userId))).toHaveLength(0);
    expect(await subsOf(user.userId)).toHaveLength(0);
  });
});
