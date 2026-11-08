import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const base = () => ({
  title: "Veg pulao and raita",
  pickupLat: 13.63,
  pickupLng: 79.42,
  pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
  pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
});

const details = { diet: "veg", servings: 4, cookedAt: ago(HOUR), bringContainer: true };

const create = (cookie: string, body: object) =>
  authedRequest(app, "/posts", cookie, { method: "POST", body: JSON.stringify(body) });

describe("food details on a new post", () => {
  it("are required: veg or not, how many it serves, and when it was cooked", async () => {
    const user = await createVerifiedUser(app);

    const res = await create(user.cookie, base());
    expect(res.status).toBe(400);
    const { details: errors } = await res.json();
    expect(errors.diet).toEqual(["Choose veg, egg or non-veg"]);
    expect(errors.servings).toEqual(["Enter how many people it serves"]);
    expect(errors.cookedAt).toBeDefined();
  });

  it("are saved and shown in the feed, on the post and in My posts", async () => {
    const poster = await createVerifiedUser(app);
    const res = await create(poster.cookie, { ...base(), ...details });
    expect(res.status).toBe(201);
    const { post } = await res.json();

    const viewer = await createVerifiedUser(app);
    const feed = await (await authedRequest(app, "/posts?lat=13.63&lng=79.42", viewer.cookie)).json();
    const page = await (await authedRequest(app, `/posts/${post.id}`, viewer.cookie)).json();
    const mine = await (await authedRequest(app, "/posts/mine", poster.cookie)).json();

    for (const shown of [feed.posts[0], page.post, mine.posts[0]]) {
      expect(shown).toMatchObject({ diet: "veg", servings: 4, bringContainer: true });
      expect(new Date(shown.cookedAt).toISOString()).toBe(new Date(details.cookedAt).toISOString());
    }
  });

  it("don't need a container unless asked", async () => {
    const user = await createVerifiedUser(app);
    const { bringContainer: _, ...rest } = details;
    const res = await create(user.cookie, { ...base(), ...rest });
    expect((await res.json()).post.bringContainer).toBe(false);
  });

  it("refuse an unknown diet or a serving count out of range", async () => {
    const user = await createVerifiedUser(app);
    for (const bad of [{ diet: "vegan" }, { servings: 0 }, { servings: 51 }, { servings: 2.5 }]) {
      expect((await create(user.cookie, { ...base(), ...details, ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    for (const diet of ["veg", "egg", "non_veg"]) {
      expect((await create(user.cookie, { ...base(), ...details, diet })).status).toBe(201);
    }
  });

  it("refuse a cooked time in the future or more than a day ago", async () => {
    const user = await createVerifiedUser(app);

    const future = await create(user.cookie, { ...base(), ...details, cookedAt: ago(-HOUR) });
    expect(future.status).toBe(400);
    expect((await future.json()).details.cookedAt).toEqual(["That time hasn't happened yet"]);

    const stale = await create(user.cookie, { ...base(), ...details, cookedAt: ago(25 * HOUR) });
    expect((await stale.json()).details.cookedAt).toEqual(["Food cooked more than a day ago can't be shared"]);

    expect((await create(user.cookie, { ...base(), ...details, cookedAt: ago(23 * HOUR) })).status).toBe(201);
  });
});

describe("editing food details", () => {
  it("changes what's sent and keeps what isn't", async () => {
    const user = await createVerifiedUser(app);
    const { post } = await (await create(user.cookie, { ...base(), ...details })).json();

    const res = await authedRequest(app, `/posts/${post.id}`, user.cookie, {
      method: "PATCH",
      body: JSON.stringify({ ...base(), diet: "egg", servings: 6 }),
    });
    expect(res.status).toBe(200);

    const page = await (await authedRequest(app, `/posts/${post.id}`, user.cookie)).json();
    expect(page.post).toMatchObject({ diet: "egg", servings: 6, bringContainer: true });
  });
});

describe("My requests", () => {
  it("shows the food details of what was asked for", async () => {
    const poster = await createVerifiedUser(app);
    const picker = await createVerifiedUser(app);
    const { post } = await (await create(poster.cookie, { ...base(), ...details })).json();
    await authedRequest(app, "/requests", picker.cookie, {
      method: "POST",
      body: JSON.stringify({ postId: post.id, pickerName: "Picker", etaMinutes: 10, lat: 13.63, lng: 79.42 }),
    });

    const { requests } = await (await authedRequest(app, "/requests/mine", picker.cookie)).json();
    expect(requests[0]).toMatchObject({ postDiet: "veg", postServings: 4, postBringContainer: true });
  });
});
