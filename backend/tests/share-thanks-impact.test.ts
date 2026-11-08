import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
  sendReportEmail: vi.fn(),
}));

import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, notifications, pickupRequests } from "../src/db/schema.js";
import { resetImpactCache } from "../src/routes/stats.js";
import { runAutoComplete, AUTO_COMPLETE_AFTER_MS } from "../src/jobs/expiry.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  resetImpactCache();
});

const post = (cookie: string, path: string, body?: unknown) =>
  authedRequest(app, path, cookie, { method: "POST", body: JSON.stringify(body ?? {}) });

async function share(cookie: string, overrides: Record<string, unknown> = {}) {
  const res = await post(cookie, "/posts", {
    title: "Veg pulao",
    pickupLat: 13.6312,
    pickupLng: 79.4234,
    pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    diet: "veg",
    servings: 4,
    cookedAt: new Date().toISOString(),
    ...overrides,
  });
  expect(res.status).toBe(201);
  return (await res.json()).post.id as string;
}

async function approvedPickup() {
  const poster = await createVerifiedUser(app, { name: "Padma Poster" });
  const picker = await createVerifiedUser(app);
  const postId = await share(poster.cookie);
  const asked = await post(picker.cookie, "/requests", { postId, pickerName: "Lakshmi", etaMinutes: 10, lat: 13.63, lng: 79.42 });
  const requestId = (await asked.json()).request.id as string;
  await post(poster.cookie, `/requests/${requestId}/approve`);
  return { poster, picker, postId, requestId };
}

const thankedNotices = async (userId: string) => {
  await new Promise((r) => setTimeout(r, 100));
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, "pickup_thanked")));
};

describe("the share page", () => {
  it("previews a live post for link previews, without anything that locates or names the poster", async () => {
    const poster = await createVerifiedUser(app, { name: "Padma Poster" });
    const postId = await share(poster.cookie);

    const res = await app.request(`/share/${postId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const html = await res.text();

    expect(html).toContain(`<meta property="og:title" content="Veg pulao">`);
    expect(html).toMatch(/og:description" content="Veg, serves 4\. Free on Jyo in Tirupati\. Pick up by /);
    expect(html).toContain(`url=http://localhost:5173/posts/${postId}`);
    for (const secret of ["13.6312", "79.4234", "Padma", poster.email, poster.userId]) {
      expect(html).not.toContain(secret);
    }
  });

  it("escapes what the poster typed", async () => {
    const poster = await createVerifiedUser(app);
    const postId = await share(poster.cookie, { title: `Rice "<script>alert(1)</script>"` });
    const html = await (await app.request(`/share/${postId}`)).text();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("shares nothing about a post that isn't live, a demo sample, or one that doesn't exist", async () => {
    const poster = await createVerifiedUser(app);
    const expired = await share(poster.cookie, { title: "Old curry" });
    await db.update(foodPosts).set({ status: "expired" }).where(eq(foodPosts.id, expired));
    const demo = await share(poster.cookie, { title: "Sample dish" });
    await db.update(foodPosts).set({ isDemo: true }).where(eq(foodPosts.id, demo));

    for (const id of [expired, demo, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      const html = await (await app.request(`/share/${id}`)).text();
      expect(html).toContain("no longer available");
      expect(html).toContain("url=http://localhost:5173/");
      expect(html).not.toContain("Old curry");
      expect(html).not.toContain("Sample dish");
    }
  });
});

describe("the picker saying they picked it up", () => {
  it("marks the food collected, keeps the note for the poster and tells them, once", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();

    const res = await post(picker.cookie, `/requests/${requestId}/collected`, { note: "Thank you, it was lovely!" });
    expect(res.status).toBe(200);
    expect((await post(picker.cookie, `/requests/${requestId}/collected`, { note: "again" })).status).toBe(200);

    expect((await db.select().from(foodPosts).where(eq(foodPosts.id, postId)))[0].status).toBe("completed");
    const [req] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, requestId));
    expect(req.thankYouNote).toBe("Thank you, it was lovely!");
    expect(req.pickedUpAt).not.toBeNull();
    const notices = await thankedNotices(poster.userId);
    expect(notices).toHaveLength(1);
    expect(notices[0].message).not.toContain("Lakshmi");

    const asPoster = await (await authedRequest(app, `/posts/${postId}`, poster.cookie)).json();
    expect(asPoster.thanks).toMatchObject({ pickerName: "Lakshmi", note: "Thank you, it was lovely!" });
    const asPicker = await (await authedRequest(app, `/posts/${postId}`, picker.cookie)).json();
    expect(asPicker.myRequest.pickedUp).toBe(true);
    expect(asPicker.thanks).toBeNull();
  });

  it("still lets the picker say thanks after the poster marked it collected", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();
    await post(poster.cookie, `/posts/${postId}/complete`);

    expect((await post(picker.cookie, `/requests/${requestId}/collected`)).status).toBe(200);
    expect(await thankedNotices(poster.userId)).toHaveLength(1);
  });

  it("is only for the approved picker, on a pickup that's still on", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();
    expect((await post(poster.cookie, `/requests/${requestId}/collected`)).status).toBe(403);
    expect((await post(picker.cookie, `/requests/${requestId}/collected`, { note: "x".repeat(201) })).status).toBe(400);

    await post(poster.cookie, `/posts/${postId}/reopen`);
    const res = await post(picker.cookie, `/requests/${requestId}/collected`);
    expect(res.status).toBe(409);
    expect((await db.select().from(foodPosts).where(eq(foodPosts.id, postId)))[0].status).toBe("open");
  });

  it("can't land on a pickup the poster is calling off at the same moment", async () => {
    const { poster, picker, postId, requestId } = await approvedPickup();

    await Promise.all([
      post(picker.cookie, `/requests/${requestId}/collected`),
      post(poster.cookie, `/posts/${postId}/reopen`),
    ]);

    const [p] = await db.select().from(foodPosts).where(eq(foodPosts.id, postId));
    const [r] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, requestId));
    if (p.status === "completed") {
      expect(r.status).toBe("approved");
      expect(r.pickedUpAt).not.toBeNull();
    } else {
      expect(p.status).toBe("open");
      expect(r.status).toBe("missed");
      expect(r.pickedUpAt).toBeNull();
    }
  });
});

describe("impact", () => {
  it("counts the meals in confirmed pickups only", async () => {
    const confirmed = await approvedPickup();
    await post(confirmed.picker.cookie, `/requests/${confirmed.requestId}/collected`);

    const assumed = await approvedPickup();
    const end = (await db.select().from(foodPosts).where(eq(foodPosts.id, assumed.postId)))[0].pickupWindowEnd.getTime();
    await runAutoComplete(new Date(end + AUTO_COMPLETE_AFTER_MS + 60_000));

    const poster = await createVerifiedUser(app);
    await share(poster.cookie);

    const res = await app.request("/stats/impact");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mealsShared: 4, pickups: 1 });
  });

  it("adds meals shared to the poster's own stats", async () => {
    const { poster, picker, requestId } = await approvedPickup();
    await post(picker.cookie, `/requests/${requestId}/collected`);

    const { stats } = await (await authedRequest(app, "/users/me/stats", poster.cookie)).json();
    expect(stats.mealsShared).toBe(4);
  });
});
