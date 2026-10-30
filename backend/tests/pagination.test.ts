import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { sql } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, pickupRequests } from "../src/db/schema.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();
const HOUR = 3_600_000;
const MINUTE = 60_000;

type PostStatus = "open" | "pending_approval" | "closed" | "completed" | "expired";
type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// Seeded directly, so each test can set statuses and times exactly.
async function seedPost(
  posterId: string,
  title: string,
  status: PostStatus,
  { endsInHours = 2, createdMinutesAgo = 0, description }: { endsInHours?: number; createdMinutesAgo?: number; description?: string } = {}
) {
  const now = Date.now();
  const [row] = await db
    .insert(foodPosts)
    .values({
      posterId,
      title,
      description,
      status,
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(now - HOUR),
      pickupWindowEnd: new Date(now + endsInHours * HOUR),
      createdAt: new Date(now - createdMinutesAgo * MINUTE),
    })
    .returning({ id: foodPosts.id });
  return row.id;
}

async function seedRequest(pickerId: string, postId: string, status: RequestStatus, createdMinutesAgo = 0) {
  const [row] = await db
    .insert(pickupRequests)
    .values({
      postId,
      pickerId,
      pickerName: "Picker",
      etaMinutes: 15,
      status,
      createdAt: new Date(Date.now() - createdMinutesAgo * MINUTE),
    })
    .returning({ id: pickupRequests.id });
  return row.id;
}

async function getJson(cookie: string, path: string) {
  const res = await authedRequest(app, path, cookie);
  return { status: res.status, body: await res.json() };
}

// Follows nextCursor until the end (from `startCursor`, if given),
// collecting one field from every item.
async function walk(cookie: string, path: string, key: "posts" | "requests", field: string, startCursor: string | null = null) {
  const seen: string[] = [];
  let cursor = startCursor;
  let pages = 0;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const { status, body } = await getJson(cookie, `${path}${cursor ? `${sep}cursor=${cursor}` : ""}`);
    expect(status).toBe(200);
    seen.push(...body[key].map((item: Record<string, string>) => item[field]));
    cursor = body.nextCursor;
    pages += 1;
  } while (cursor && pages < 20);
  return { seen, pages };
}

describe("GET /posts/mine (paged)", () => {
  // The order My posts shows: an answer needed, then a pickup to confirm,
  // then still waiting (each soonest-ending first); then collected, then
  // ended (each newest first).
  async function seedMix(posterId: string) {
    await seedPost(posterId, "open-late", "open", { endsInHours: 5 });
    await seedPost(posterId, "open-soon", "open", { endsInHours: 1 });
    await seedPost(posterId, "closed", "closed", { endsInHours: 3 });
    await seedPost(posterId, "pending", "pending_approval", { endsInHours: 4 });
    await seedPost(posterId, "ended-old", "expired", { endsInHours: -5, createdMinutesAgo: 300 });
    await seedPost(posterId, "ended-new", "expired", { endsInHours: -1, createdMinutesAgo: 60 });
    await seedPost(posterId, "collected", "completed", { endsInHours: -2, createdMinutesAgo: 120 });
  }
  const ORDER = ["pending", "closed", "open-soon", "open-late", "collected", "ended-new", "ended-old"];

  it("pages through every post once, in My posts' order", async () => {
    const user = await createVerifiedUser(app, { email: "paged-posts@example.com" });
    await seedMix(user.userId);

    const { seen, pages } = await walk(user.cookie, "/posts/mine?limit=2", "posts", "title");
    expect(seen).toEqual(ORDER);
    expect(pages).toBe(4);
  });

  it("filters by group and counts each group", async () => {
    const user = await createVerifiedUser(app, { email: "filtered-posts@example.com" });
    await seedMix(user.userId);

    const { body } = await getJson(user.cookie, "/posts/mine?status=active");
    expect(body.posts.map((p: { title: string }) => p.title)).toEqual(["pending", "closed", "open-soon", "open-late"]);
    expect(body.nextCursor).toBeNull();
    expect(body.counts).toEqual({ all: 7, active: 4, collected: 1, ended: 2 });
    expect(body.total).toBe(7);
  });

  it("searches every word in any order, and counts only matches", async () => {
    const user = await createVerifiedUser(app, { email: "search-posts@example.com" });
    await seedPost(user.userId, "Curd rice for 2", "open");
    await seedPost(user.userId, "Rice and dal", "expired", { description: "with curd on the side" });
    await seedPost(user.userId, "Idli", "open");
    await seedPost(user.userId, "100% fresh dosa", "open");

    const curdRice = await getJson(user.cookie, "/posts/mine?search=RICE%20curd");
    expect(curdRice.body.posts.map((p: { title: string }) => p.title).sort()).toEqual(["Curd rice for 2", "Rice and dal"]);
    expect(curdRice.body.counts).toEqual({ all: 2, active: 1, collected: 0, ended: 1 });
    expect(curdRice.body.total).toBe(4);

    // % is matched as a character, not as "anything".
    const percent = await getJson(user.cookie, `/posts/mine?search=${encodeURIComponent("0%")}`);
    expect(percent.body.posts.map((p: { title: string }) => p.title)).toEqual(["100% fresh dosa"]);
  });

  // The point of a cursor: something arriving mid-scroll, ahead of where
  // you are, can't push what you've seen onto the next page.
  it("doesn't repeat or skip anything when a post arrives mid-scroll", async () => {
    const user = await createVerifiedUser(app, { email: "midscroll-posts@example.com" });
    await seedMix(user.userId);

    const first = await getJson(user.cookie, "/posts/mine?limit=3");
    await seedPost(user.userId, "arrived-first-in-order", "pending_approval", { endsInHours: 0.5 });
    const rest = await walk(user.cookie, "/posts/mine?limit=3", "posts", "title", first.body.nextCursor);

    const titles = [...first.body.posts.map((p: { title: string }) => p.title), ...rest.seen];
    expect(titles).toEqual(ORDER);
  });

  // Regression: the cursor carried seconds as a float, which Supabase returns
  // rounded to 15 significant digits, losing the microseconds; the item at
  // each page boundary then came back again on the next page. Rows created
  // microseconds apart are exactly where that bites.
  it("keeps exact page boundaries between items microseconds apart", async () => {
    const user = await createVerifiedUser(app, { email: "micro-posts@example.com" });
    const base = Date.now() - HOUR;
    for (let i = 0; i < 7; i++) {
      await db.insert(foodPosts).values({
        posterId: user.userId,
        title: `ended-${i}`,
        status: "expired",
        pickupLat: 13.63,
        pickupLng: 79.42,
        pickupWindowStart: new Date(base - 2 * HOUR),
        pickupWindowEnd: new Date(base - HOUR),
        // Same millisecond for all; Postgres keeps the microseconds below.
        createdAt: new Date(base),
      });
    }
    await db.execute(sql`update food_posts set created_at = created_at + (random() * interval '900 microseconds')`);

    const { seen } = await walk(user.cookie, "/posts/mine?status=ended&limit=2", "posts", "id");
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);

    const first = await getJson(user.cookie, "/posts/mine?status=ended&limit=2");
    const [, value] = JSON.parse(Buffer.from(first.body.nextCursor, "base64url").toString("utf8"));
    expect(value).toMatch(/^-?\d+$/);
  });

  it("only lists your own posts", async () => {
    const me = await createVerifiedUser(app, { email: "mine-only@example.com" });
    const other = await createVerifiedUser(app, { email: "not-mine@example.com" });
    await seedPost(me.userId, "mine", "open");
    await seedPost(other.userId, "theirs", "open");

    const { body } = await getJson(me.cookie, "/posts/mine");
    expect(body.posts.map((p: { title: string }) => p.title)).toEqual(["mine"]);
    expect(body.total).toBe(1);
  });

  it("refuses a bad cursor, limit or filter with a 400", async () => {
    const user = await createVerifiedUser(app, { email: "bad-page@example.com" });
    for (const query of ["cursor=not-a-cursor", "limit=0", "limit=51", "limit=ten", "status=archived"]) {
      const { status } = await getJson(user.cookie, `/posts/mine?${query}`);
      expect(status, query).toBe(400);
    }
  });
});

describe("GET /requests/mine (paged)", () => {
  it("pages through every request once, grouped as My requests shows them", async () => {
    const poster = await createVerifiedUser(app, { email: "req-poster@example.com" });
    const picker = await createVerifiedUser(app, { email: "req-picker@example.com" });

    const post = (title: string, status: PostStatus, endsInHours: number) =>
      seedPost(poster.userId, title, status, { endsInHours });

    // Approved and waiting are soonest-ending first; the rest newest first.
    await seedRequest(picker.userId, await post("waiting-late", "pending_approval", 6), "pending");
    await seedRequest(picker.userId, await post("waiting-soon", "pending_approval", 2), "pending");
    await seedRequest(picker.userId, await post("approved", "closed", 3), "approved");
    await seedRequest(picker.userId, await post("collected", "completed", -1), "approved", 30);
    await seedRequest(picker.userId, await post("declined-old", "open", 4), "rejected", 200);
    await seedRequest(picker.userId, await post("declined-new", "open", 4), "rejected", 100);
    await seedRequest(picker.userId, await post("cancelled", "open", 4), "cancelled", 50);

    const { seen } = await walk(picker.cookie, "/requests/mine?limit=3", "requests", "postTitle");
    expect(seen).toEqual([
      "approved",
      "waiting-soon",
      "waiting-late",
      "collected",
      "declined-new",
      "declined-old",
      "cancelled",
    ]);

    const waiting = await getJson(picker.cookie, "/requests/mine?status=waiting");
    expect(waiting.body.requests.map((r: { postTitle: string }) => r.postTitle)).toEqual(["waiting-soon", "waiting-late"]);
    expect(waiting.body.counts).toEqual({ all: 7, approved: 1, waiting: 2, collected: 1, declined: 2, cancelled: 1 });
    expect(waiting.body.total).toBe(7);
  });
});

describe("GET /users/me/stats", () => {
  it("counts posts shared, picked up and requests made", async () => {
    const me = await createVerifiedUser(app, { email: "stats-me@example.com" });
    const other = await createVerifiedUser(app, { email: "stats-other@example.com" });
    await seedPost(me.userId, "a", "open");
    await seedPost(me.userId, "b", "completed");
    await seedPost(me.userId, "c", "completed");
    await seedRequest(me.userId, await seedPost(other.userId, "theirs", "pending_approval"), "pending");

    const { status, body } = await getJson(me.cookie, "/users/me/stats");
    expect(status).toBe(200);
    expect(body.stats).toEqual({ shared: 3, pickedUp: 2, requested: 1 });
  });
});
