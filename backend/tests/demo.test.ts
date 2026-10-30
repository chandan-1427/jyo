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
import { users, foodPosts, pickupRequests, notifications } from "../src/db/schema.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";
import { isSyntheticEmail, provisionSeededPost, seedRequestOnOwnPost, DEMO_SESSION_MS } from "../src/lib/domain/demo.js";
import { runDemoCleanup } from "../src/jobs/demoCleanup.js";

const app = createApp();
const TIRUPATI = { lat: 13.6288, lng: 79.4192 };

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// Calls the real POST /auth/demo/start endpoint and returns a session
// cookie whose JWT already carries isDemo:true — mirrors exactly what a
// user clicking "Start Demo" in the app gets.
async function startDemo(cookie: string) {
  const res = await authedRequest(app, "/auth/demo/start", cookie, { method: "POST" });
  expect(res.status).toBe(200);
  const body = await res.json();
  const setCookie = res.headers.get("set-cookie")!;
  return { cookie: setCookie.split(";")[0], demoExpiresAt: body.demoExpiresAt as string };
}

async function makeDemoUser(email: string) {
  const user = await createVerifiedUser(app, { email });
  const { cookie, demoExpiresAt } = await startDemo(user.cookie);
  return { ...user, cookie, demoExpiresAt };
}

describe("isSyntheticEmail", () => {
  it("flags only @jyo.internal addresses", () => {
    expect(isSyntheticEmail("demo-abc@jyo.internal")).toBe(true);
    expect(isSyntheticEmail("real.user@gmail.com")).toBe(false);
  });
});

describe("POST /auth/demo/start and /stop", () => {
  it("lets any logged-in user opt into demo mode and bypass the geofence", async () => {
    const user = await createVerifiedUser(app, { email: "toggle@example.com" });
    const { cookie } = await startDemo(user.cookie);

    // Chennai — outside the 20km Tirupati radius. Only reachable if the
    // demo-mode geofence bypass in posts.ts actually took effect.
    const res = await authedRequest(app, "/posts", cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Demo post far from Tirupati",
        pickupLat: 13.0827,
        pickupLng: 80.2707,
        pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
        pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    });
    expect(res.status).toBe(201);

    const [dbUser] = await db.select().from(users).where(eq(users.id, user.userId));
    expect(dbUser.isDemo).toBe(true);
    expect(dbUser.demoExpiresAt).not.toBeNull();
  });

  it("lets a user exit demo mode early", async () => {
    const demoUser = await makeDemoUser("exit@example.com");

    const stopRes = await authedRequest(app, "/auth/demo/stop", demoUser.cookie, { method: "POST" });
    expect(stopRes.status).toBe(200);

    const [dbUser] = await db.select().from(users).where(eq(users.id, demoUser.userId));
    expect(dbUser.isDemo).toBe(false);
    expect(dbUser.demoExpiresAt).toBeNull();
  });

  // A cookie can outlive its account; re-signing a token for no one used to
  // crash with a 500.
  it("logs out a session whose account no longer exists", async () => {
    const user = await createVerifiedUser(app, { email: "gone@example.com" });
    await db.delete(users).where(eq(users.id, user.userId));

    const res = await authedRequest(app, "/auth/demo/start", user.cookie, { method: "POST" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/^token=;/);
  });

  // Regression: demo rows outlive the session until the cleanup cron, and
  // the lists only filtered on ownership, so exiting early left demo posts,
  // requests and notifications showing in the user's normal feed and lists.
  it("hides demo content from every list once the user exits, but keeps real content", async () => {
    const neighbour = await createVerifiedUser(app, { email: "neighbour@example.com" });
    const realPost = await authedRequest(app, "/posts", neighbour.cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "Real leftover rice",
        pickupLat: TIRUPATI.lat,
        pickupLng: TIRUPATI.lng,
        pickupWindowStart: new Date().toISOString(),
        pickupWindowEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });
    expect(realPost.status).toBe(201);

    const visitor = await makeDemoUser("exit-lists@example.com");
    const feedUrl = `/posts?lat=${TIRUPATI.lat}&lng=${TIRUPATI.lng}`;

    // In demo: request the seeded post (a demo request), then load the feed
    // again so a fresh open seeded post is provisioned.
    await authedRequest(app, feedUrl, visitor.cookie);
    const [seeded] = await db.select().from(foodPosts).where(eq(foodPosts.seededForUserId, visitor.userId));
    const requested = await authedRequest(app, "/requests", visitor.cookie, {
      method: "POST",
      body: JSON.stringify({ postId: seeded.id, pickerName: "Demo Visitor", etaMinutes: 15, lat: TIRUPATI.lat, lng: TIRUPATI.lng }),
    });
    expect(requested.status).toBe(201);
    await authedRequest(app, feedUrl, visitor.cookie);

    // A demo post of their own, which gets a synthetic request and a notification.
    const ownDemoPost = await authedRequest(app, "/posts", visitor.cookie, {
      method: "POST",
      body: JSON.stringify({
        title: "My demo post",
        pickupLat: TIRUPATI.lat,
        pickupLng: TIRUPATI.lng,
        pickupWindowStart: new Date().toISOString(),
        pickupWindowEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });
    expect(ownDemoPost.status).toBe(201);
    await vi.waitFor(async () => {
      const rows = await db.select().from(notifications).where(eq(notifications.userId, visitor.userId));
      expect(rows.some((n) => n.isDemo)).toBe(true);
    });

    const stopRes = await authedRequest(app, "/auth/demo/stop", visitor.cookie, { method: "POST" });
    const realCookie = stopRes.headers.get("set-cookie")!.split(";")[0];

    const feed = await (await authedRequest(app, feedUrl, realCookie)).json();
    expect(feed.posts.some((p: { isDemo?: boolean }) => p.isDemo)).toBe(false);
    expect(feed.posts.some((p: { title: string }) => p.title === "Real leftover rice")).toBe(true);

    const mine = await (await authedRequest(app, "/posts/mine", realCookie)).json();
    expect(mine.posts.some((p: { isDemo: boolean }) => p.isDemo)).toBe(false);

    const myRequests = await (await authedRequest(app, "/requests/mine", realCookie)).json();
    expect(myRequests.requests.some((r: { isDemo: boolean }) => r.isDemo)).toBe(false);

    const notifs = await (await authedRequest(app, "/notifications", realCookie)).json();
    expect(notifs.notifications).toHaveLength(0);
  });
});

describe("provisionSeededPost", () => {
  it("is idempotent under concurrent calls — only one seeded post per visitor", async () => {
    const visitor = await createVerifiedUser(app, { email: "provision@example.com" });

    await Promise.all([
      provisionSeededPost(visitor.userId, TIRUPATI.lat, TIRUPATI.lng),
      provisionSeededPost(visitor.userId, TIRUPATI.lat, TIRUPATI.lng),
    ]);

    const seeded = await db.select().from(foodPosts).where(eq(foodPosts.seededForUserId, visitor.userId));
    expect(seeded).toHaveLength(1);
    expect(seeded[0].isDemo).toBe(true);
  });

  it("shows up in the visitor's feed once demo mode is on", async () => {
    const visitor = await makeDemoUser("feed-demo@example.com");

    const res = await authedRequest(app, `/posts?lat=${TIRUPATI.lat}&lng=${TIRUPATI.lng}`, visitor.cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts.some((p: { isDemo?: boolean }) => p.isDemo)).toBe(true);
  });
});

describe("demo auto-approve flow", () => {
  it("auto-approves instantly when a demo visitor requests the seeded post", async () => {
    const visitor = await makeDemoUser("autoapprove@example.com");

    await provisionSeededPost(visitor.userId, TIRUPATI.lat, TIRUPATI.lng);
    const [seededPost] = await db
      .select()
      .from(foodPosts)
      .where(eq(foodPosts.seededForUserId, visitor.userId));

    const res = await authedRequest(app, "/requests", visitor.cookie, {
      method: "POST",
      body: JSON.stringify({
        postId: seededPost.id,
        pickerName: "Demo Visitor",
        etaMinutes: 15,
        lat: TIRUPATI.lat,
        lng: TIRUPATI.lng,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();

    const [updatedPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, seededPost.id));
    expect(updatedPost.status).toBe("closed");

    const [request] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, body.request.id));
    expect(request.status).toBe("approved");
    // Regression: this request must carry the post's demo expiry, or the
    // cleanup cron's demoExpiresAt-based query never finds it and it
    // lingers in "My Requests" forever after the demo session ends.
    expect(request.isDemo).toBe(true);
    expect(request.demoExpiresAt).not.toBeNull();
  });

  it("provisions a fresh seeded post once the previous one is claimed", async () => {
    // Regression: provisionSeededPost's "already has an active post" check
    // used to only look at demoExpiresAt, not status — so once the seeded
    // post was requested (status -> closed via auto-approve), a visitor's
    // feed stayed empty for the rest of their session. The partial unique
    // index (drizzle/0008) narrows to status='open' so a new one can be
    // inserted, and provisionSeededPost's own check must match it.
    const visitor = await makeDemoUser("reprovision@example.com");

    await provisionSeededPost(visitor.userId, TIRUPATI.lat, TIRUPATI.lng);
    const [firstPost] = await db
      .select()
      .from(foodPosts)
      .where(eq(foodPosts.seededForUserId, visitor.userId));

    await authedRequest(app, "/requests", visitor.cookie, {
      method: "POST",
      body: JSON.stringify({
        postId: firstPost.id,
        pickerName: "Demo Visitor",
        etaMinutes: 15,
        lat: TIRUPATI.lat,
        lng: TIRUPATI.lng,
      }),
    });

    const [closedPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, firstPost.id));
    expect(closedPost.status).toBe("closed");

    await provisionSeededPost(visitor.userId, TIRUPATI.lat, TIRUPATI.lng);

    const seededPosts = await db
      .select()
      .from(foodPosts)
      .where(eq(foodPosts.seededForUserId, visitor.userId));
    expect(seededPosts).toHaveLength(2);
    expect(seededPosts.some((p) => p.status === "open" && p.id !== firstPost.id)).toBe(true);
  });
});

describe("seedRequestOnOwnPost", () => {
  it("creates a pending request from a synthetic picker and notifies the poster", async () => {
    const poster = await createVerifiedUser(app, { email: "ownpost@example.com" });
    const demoExpiresAt = new Date(Date.now() + DEMO_SESSION_MS);

    const [post] = await db
      .insert(foodPosts)
      .values({
        posterId: poster.userId,
        title: "Visitor's own post",
        pickupLat: TIRUPATI.lat,
        pickupLng: TIRUPATI.lng,
        pickupWindowStart: new Date(),
        pickupWindowEnd: demoExpiresAt,
        isDemo: true,
        demoExpiresAt,
      })
      .returning();

    await seedRequestOnOwnPost(post.id, poster.userId, demoExpiresAt);

    const requests = await db.select().from(pickupRequests).where(eq(pickupRequests.postId, post.id));
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("pending");
    expect(requests[0].isDemo).toBe(true);

    // The notification is fire-and-forget, so it can land just after the
    // function returns; checking only once made this test flaky on CI.
    await vi.waitFor(async () => {
      const notifs = await db.select().from(notifications).where(eq(notifications.userId, poster.userId));
      expect(notifs.some((n) => n.type === "request_received")).toBe(true);
    });
  });
});

describe("demo cleanup cron", () => {
  it("deletes expired demo rows across all four tables in FK-safe order with no violation", async () => {
    const past = new Date(Date.now() - 60_000);

    const [syntheticUser] = await db
      .insert(users)
      .values({
        name: "Synthetic",
        email: "demo-cleanup-test@jyo.internal",
        passwordHash: "x",
        phone: "0000000000",
        emailVerified: true,
        isDemo: true,
        demoExpiresAt: past,
      })
      .returning();

    const [post] = await db
      .insert(foodPosts)
      .values({
        posterId: syntheticUser.id,
        title: "Expired demo post",
        pickupLat: TIRUPATI.lat,
        pickupLng: TIRUPATI.lng,
        pickupWindowStart: past,
        pickupWindowEnd: past,
        isDemo: true,
        demoExpiresAt: past,
      })
      .returning();

    const [request] = await db
      .insert(pickupRequests)
      .values({
        postId: post.id,
        pickerId: syntheticUser.id,
        pickerName: "Synthetic",
        etaMinutes: 15,
        isDemo: true,
        demoExpiresAt: past,
      })
      .returning();

    await db.insert(notifications).values({
      userId: syntheticUser.id,
      postId: post.id,
      message: "test",
      type: "request_received",
      isDemo: true,
      demoExpiresAt: past,
    });

    await runDemoCleanup();

    const [remainingUser] = await db.select().from(users).where(eq(users.id, syntheticUser.id));
    const [remainingPost] = await db.select().from(foodPosts).where(eq(foodPosts.id, post.id));
    const [remainingRequest] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, request.id));

    expect(remainingUser).toBeUndefined();
    expect(remainingPost).toBeUndefined();
    expect(remainingRequest).toBeUndefined();
  });

  it("resets (never deletes) a real user's account once their demo session expires", async () => {
    const demoUser = await makeDemoUser("real-expired@example.com");

    // Fast-forward past expiry without waiting 10 real minutes.
    await db
      .update(users)
      .set({ demoExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(users.id, demoUser.userId));

    await runDemoCleanup();

    const [afterCleanup] = await db.select().from(users).where(eq(users.id, demoUser.userId));
    expect(afterCleanup).toBeDefined();
    expect(afterCleanup.isDemo).toBe(false);
    expect(afterCleanup.demoExpiresAt).toBeNull();
  });
});
