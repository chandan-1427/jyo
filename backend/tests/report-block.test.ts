import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
  sendReportEmail: vi.fn(),
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

import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { blocks, foodPosts, notifications, pickupRequests, reports, users } from "../src/db/schema.js";
import { notifyPicker, sendReportEmail } from "../src/lib/mailer.js";
import { purgeAccount } from "../src/lib/domain/deleteAccount.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const post = (cookie: string, path: string, body?: unknown) =>
  authedRequest(app, path, cookie, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

async function share(cookie: string, title = "Veg pulao") {
  const res = await post(cookie, "/posts", {
    title,
    pickupLat: 13.63,
    pickupLng: 79.42,
    pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    diet: "veg",
    servings: 2,
    cookedAt: new Date().toISOString(),
  });
  expect(res.status).toBe(201);
  return (await res.json()).post.id as string;
}

async function ask(cookie: string, postId: string) {
  return post(cookie, "/requests", { postId, pickerName: "Lakshmi", etaMinutes: 10, lat: 13.63, lng: 79.42 });
}

const feedTitles = async (cookie: string) =>
  ((await (await authedRequest(app, "/posts?lat=13.63&lng=79.42", cookie)).json()).posts as { title: string }[]).map(
    (p) => p.title
  );

describe("reporting a post", () => {
  it("is stored once and emailed once, however many times it's sent", async () => {
    const poster = await createVerifiedUser(app);
    const viewer = await createVerifiedUser(app);
    const postId = await share(poster.cookie);

    const first = await post(viewer.cookie, `/posts/${postId}/report`, { reason: "unsafe_food", details: "Smelled off" });
    expect(first.status).toBe(201);
    expect((await first.json()).message).toMatch(/look into it/);
    expect((await post(viewer.cookie, `/posts/${postId}/report`, { reason: "unsafe_food" })).status).toBe(200);

    const rows = await db.select().from(reports);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reporterId: viewer.userId,
      reportedUserId: poster.userId,
      postId,
      postTitle: "Veg pulao",
      reason: "unsafe_food",
      details: "Smelled off",
    });
    expect(vi.mocked(sendReportEmail)).toHaveBeenCalledTimes(1);
  });

  it("checks the reason and the note", async () => {
    const poster = await createVerifiedUser(app);
    const viewer = await createVerifiedUser(app);
    const postId = await share(poster.cookie);

    const noReason = await post(viewer.cookie, `/posts/${postId}/report`, {});
    expect((await noReason.json()).details.reason).toEqual(["Choose a reason"]);
    expect((await post(viewer.cookie, `/posts/${postId}/report`, { reason: "spam" })).status).toBe(400);
    expect((await post(viewer.cookie, `/posts/${postId}/report`, { reason: "other", details: "x".repeat(501) })).status).toBe(400);
  });

  it("can't be about your own post, or a post that doesn't exist", async () => {
    const poster = await createVerifiedUser(app);
    const postId = await share(poster.cookie);
    expect((await post(poster.cookie, `/posts/${postId}/report`, { reason: "other" })).status).toBe(403);
    expect((await post(poster.cookie, `/posts/not-a-uuid/report`, { reason: "other" })).status).toBe(404);
    expect((await post(poster.cookie, `/posts/00000000-0000-4000-8000-000000000000/report`, { reason: "other" })).status).toBe(404);
  });

  it("survives the post being deleted, keeping its title", async () => {
    const poster = await createVerifiedUser(app);
    const viewer = await createVerifiedUser(app);
    const postId = await share(poster.cookie, "Biryani");
    await post(viewer.cookie, `/posts/${postId}/report`, { reason: "misleading" });

    const res = await authedRequest(app, `/posts/${postId}`, poster.cookie, { method: "DELETE" });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(reports);
    expect(row).toMatchObject({ postId: null, postTitle: "Biryani" });
  });
});

describe("reporting the person who asked", () => {
  it("is only for the person sharing the food", async () => {
    const poster = await createVerifiedUser(app);
    const picker = await createVerifiedUser(app);
    const stranger = await createVerifiedUser(app);
    const postId = await share(poster.cookie);
    const requestId = (await (await ask(picker.cookie, postId)).json()).request.id;

    expect((await post(stranger.cookie, `/requests/${requestId}/report`, { reason: "harassment" })).status).toBe(403);
    expect((await post(picker.cookie, `/requests/${requestId}/report`, { reason: "harassment" })).status).toBe(403);
    expect((await post(poster.cookie, `/requests/${requestId}/report`, { reason: "harassment" })).status).toBe(201);

    const [row] = await db.select().from(reports);
    expect(row).toMatchObject({ reporterId: poster.userId, reportedUserId: picker.userId, reason: "harassment" });
  });
});

describe("blocking", () => {
  it("hides each person's posts from the other, both ways, and nobody else's", async () => {
    const a = await createVerifiedUser(app);
    const b = await createVerifiedUser(app);
    const c = await createVerifiedUser(app);
    const aPost = await share(a.cookie, "From A");
    await share(b.cookie, "From B");
    await share(c.cookie, "From C");

    expect((await post(a.cookie, `/posts/${(await db.select().from(foodPosts).where(eq(foodPosts.title, "From B")))[0].id}/block`)).status).toBe(201);

    expect(await feedTitles(a.cookie)).not.toContain("From B");
    expect(await feedTitles(b.cookie)).not.toContain("From A");
    expect(await feedTitles(c.cookie)).toEqual(expect.arrayContaining(["From A", "From B"]));
    expect((await authedRequest(app, `/posts/${aPost}`, b.cookie)).status).toBe(404);
    expect((await ask(b.cookie, aPost)).status).toBe(404);
  });

  it("from a post, cancels the blocker's own waiting request on it, quietly", async () => {
    const poster = await createVerifiedUser(app);
    const picker = await createVerifiedUser(app);
    const postId = await share(poster.cookie);
    const requestId = (await (await ask(picker.cookie, postId)).json()).request.id;
    vi.clearAllMocks();

    expect((await post(picker.cookie, `/posts/${postId}/block`)).status).toBe(201);

    expect((await db.select().from(pickupRequests).where(eq(pickupRequests.id, requestId)))[0].status).toBe("cancelled");
    expect((await db.select().from(foodPosts).where(eq(foodPosts.id, postId)))[0].status).toBe("open");
  });

  it("from a request, declines it without telling the person who asked", async () => {
    const poster = await createVerifiedUser(app);
    const picker = await createVerifiedUser(app);
    const postId = await share(poster.cookie);
    const requestId = (await (await ask(picker.cookie, postId)).json()).request.id;
    vi.clearAllMocks();

    expect((await post(poster.cookie, `/requests/${requestId}/block`)).status).toBe(201);
    expect((await post(poster.cookie, `/requests/${requestId}/block`)).status).toBe(200);

    expect((await db.select().from(pickupRequests).where(eq(pickupRequests.id, requestId)))[0].status).toBe("rejected");
    expect((await db.select().from(foodPosts).where(eq(foodPosts.id, postId)))[0].status).toBe("open");
    await new Promise((r) => setTimeout(r, 100));
    expect(await db.select().from(notifications).where(eq(notifications.userId, picker.userId))).toHaveLength(0);
    expect(vi.mocked(notifyPicker)).not.toHaveBeenCalled();
    expect((await ask(picker.cookie, postId)).status).toBe(404);
  });

  it("ends an approved pickup too, so the blocked person loses the pickup spot", async () => {
    const poster = await createVerifiedUser(app);
    const picker = await createVerifiedUser(app);
    const postId = await share(poster.cookie);
    const requestId = (await (await ask(picker.cookie, postId)).json()).request.id;
    await post(poster.cookie, `/requests/${requestId}/approve`);
    vi.clearAllMocks();

    expect((await post(poster.cookie, `/requests/${requestId}/block`)).status).toBe(201);

    expect((await db.select().from(pickupRequests).where(eq(pickupRequests.id, requestId)))[0].status).toBe("missed");
    const [after] = await db.select().from(foodPosts).where(eq(foodPosts.id, postId));
    expect(after.status).toBe("open");
    expect(after.approvedRequestId).toBeNull();
    expect((await authedRequest(app, `/posts/${postId}`, picker.cookie)).status).toBe(404);
    await new Promise((r) => setTimeout(r, 100));
    expect(await db.select().from(notifications).where(eq(notifications.userId, picker.userId))).toHaveLength(1);
  });

  it("lists who you blocked by what you saw, never by account, and unblocking undoes it", async () => {
    const poster = await createVerifiedUser(app);
    const viewer = await createVerifiedUser(app);
    const postId = await share(poster.cookie, "Curd rice");
    await post(viewer.cookie, `/posts/${postId}/block`);

    const { blocks: list } = await (await authedRequest(app, "/users/me/blocks", viewer.cookie)).json();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("Shared “Curd rice”");
    expect(JSON.stringify(list)).not.toContain(poster.userId);

    const someoneElse = await createVerifiedUser(app);
    await authedRequest(app, `/users/me/blocks/${list[0].id}`, someoneElse.cookie, { method: "DELETE" });
    expect(await db.select().from(blocks)).toHaveLength(1);

    const res = await authedRequest(app, `/users/me/blocks/${list[0].id}`, viewer.cookie, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await feedTitles(viewer.cookie)).toContain("Curd rice");
  });

  it("can't be done on your own post", async () => {
    const poster = await createVerifiedUser(app);
    const postId = await share(poster.cookie);
    expect((await post(poster.cookie, `/posts/${postId}/block`)).status).toBe(403);
  });
});

describe("when an account is erased", () => {
  it("its reports and blocks go with it, both directions", async () => {
    const a = await createVerifiedUser(app);
    const b = await createVerifiedUser(app);
    const aPost = await share(a.cookie);
    const bPost = await share(b.cookie);
    await post(b.cookie, `/posts/${aPost}/report`, { reason: "other" });
    await post(a.cookie, `/posts/${bPost}/report`, { reason: "other" });
    await post(b.cookie, `/posts/${aPost}/block`);

    await db.update(users).set({ isDeleted: true, deletedAt: new Date() }).where(eq(users.id, a.userId));
    await purgeAccount(a.userId);

    expect(await db.select().from(users).where(eq(users.id, a.userId))).toHaveLength(0);
    expect(await db.select().from(reports)).toHaveLength(0);
    expect(await db.select().from(blocks).where(and(eq(blocks.blockerId, b.userId)))).toHaveLength(0);
  });
});
