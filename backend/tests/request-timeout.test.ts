import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { and, eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { db } from "../src/db/index.js";
import { foodPosts, notifications, pickupRequests } from "../src/db/schema.js";
import { notifyPicker, notifyPoster } from "../src/lib/mailer.js";
import { runRequestTimeout } from "../src/jobs/requestTimeout.js";
import { REQUEST_TIMEOUT_MS } from "../src/lib/domain/requestActions.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();
const HOUR = 60 * 60 * 1000;
const later = (ms: number) => new Date(Date.now() + ms);

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function newPost(cookie: string) {
  const res = await authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      pickupLat: 13.63,
      pickupLng: 79.42,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + HOUR).toISOString(),
      diet: "veg", servings: 2, cookedAt: new Date().toISOString(),
    }),
  });
  return (await res.json()).post as { id: string };
}

function askFor(cookie: string, postId: string) {
  return authedRequest(app, "/requests", cookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42 }),
  });
}

async function waitingRequest() {
  const poster = await createVerifiedUser(app);
  const picker = await createVerifiedUser(app);
  const { id: postId } = await newPost(poster.cookie);
  const requestId = (await (await askFor(picker.cookie, postId)).json()).request.id as string;
  vi.clearAllMocks();
  return { poster, picker, postId, requestId };
}

const act = (cookie: string, path: string) => authedRequest(app, path, cookie, { method: "POST" });
const postStatus = async (id: string) => (await db.select().from(foodPosts).where(eq(foodPosts.id, id)))[0].status;
const requestStatus = async (id: string) =>
  (await db.select().from(pickupRequests).where(eq(pickupRequests.id, id)))[0].status;

async function timedOutNotices(userId: string) {
  await new Promise((r) => setTimeout(r, 100));
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, "request_timed_out")));
}

describe("a request nobody answers", () => {
  it("closes after 15 minutes, not before, and the food goes back in the feed", async () => {
    const { postId, requestId } = await waitingRequest();

    await runRequestTimeout(later(REQUEST_TIMEOUT_MS - 60_000));
    expect(await requestStatus(requestId)).toBe("pending");
    expect(await postStatus(postId)).toBe("pending_approval");

    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000));
    expect(await requestStatus(requestId)).toBe("timed_out");
    expect(await postStatus(postId)).toBe("open");
  });

  it("tells the picker in the app and by email, and the poster in the app only, once", async () => {
    const { poster, picker } = await waitingRequest();

    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000));
    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 120_000));

    expect(await timedOutNotices(picker.userId)).toHaveLength(1);
    expect(await timedOutNotices(poster.userId)).toHaveLength(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyPicker)).toHaveBeenCalledWith(picker.email, "request_timed_out");
    expect(vi.mocked(notifyPoster)).not.toHaveBeenCalled();
  });

  it("ends the post instead if its pickup time has already passed", async () => {
    const { postId, requestId } = await waitingRequest();
    await db.update(foodPosts).set({ pickupWindowEnd: later(5 * 60_000) }).where(eq(foodPosts.id, postId));

    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000));
    expect(await requestStatus(requestId)).toBe("timed_out");
    expect(await postStatus(postId)).toBe("expired");
  });

  it("tells a poster who answers too late what happened", async () => {
    const { poster, requestId } = await waitingRequest();
    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000));

    for (const action of ["approve", "reject"]) {
      const res = await act(poster.cookie, `/requests/${requestId}/${action}`);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/waited too long without an answer/);
    }
    expect(await requestStatus(requestId)).toBe("timed_out");
  });

  it("tells the picker it already closed if they cancel it", async () => {
    const { picker, requestId } = await waitingRequest();
    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000));

    const res = await act(picker.cookie, `/requests/${requestId}/cancel`);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/didn't answer in time/);
  });

  it("lets the picker ask again, without emailing the poster about it twice in an hour", async () => {
    const { poster, picker, postId } = await waitingRequest();
    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000));

    expect((await askFor(picker.cookie, postId)).status).toBe(201);
    expect(vi.mocked(notifyPoster)).not.toHaveBeenCalledWith(poster.email, "request_received");
  });

  it("shows both sides when the answer is due", async () => {
    const { poster, picker, postId } = await waitingRequest();

    const asPoster = await (await authedRequest(app, `/posts/${postId}`, poster.cookie)).json();
    const asPicker = await (await authedRequest(app, `/posts/${postId}`, picker.cookie)).json();
    const due = new Date(asPoster.pendingRequest.answerBy).getTime();

    expect(due - new Date(asPoster.pendingRequest.createdAt).getTime()).toBe(REQUEST_TIMEOUT_MS);
    expect(new Date(asPicker.myRequest.answerBy).getTime()).toBe(due);
  });

  it("is listed under declined in My requests", async () => {
    const { picker, requestId } = await waitingRequest();
    await runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000));

    const body = await (await authedRequest(app, "/requests/mine?status=declined", picker.cookie)).json();
    expect(body.requests.map((r: { id: string }) => r.id)).toEqual([requestId]);
  });
});

describe("the timeout and the poster's answer at the same moment", () => {
  it("lets exactly one of them happen", async () => {
    const { poster, picker, postId, requestId } = await waitingRequest();

    const [approve] = await Promise.all([
      act(poster.cookie, `/requests/${requestId}/approve`),
      runRequestTimeout(later(REQUEST_TIMEOUT_MS + 1_000)),
    ]);

    const request = await requestStatus(requestId);
    const post = await postStatus(postId);
    if (request === "approved") {
      expect(approve.status).toBe(200);
      expect(post).toBe("closed");
      expect(await timedOutNotices(picker.userId)).toHaveLength(0);
    } else {
      expect(request).toBe("timed_out");
      expect(approve.status).toBe(409);
      expect(post).toBe("open");
      expect(await timedOutNotices(picker.userId)).toHaveLength(1);
    }
  });
});
