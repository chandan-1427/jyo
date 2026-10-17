import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SSEStreamingApi } from "hono/streaming";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

import { createApp } from "../src/app.js";
import { subscribe, unsubscribe } from "../src/lib/notifications/notificationStream.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser, authedRequest } from "./helpers/auth.js";

const app = createApp();

const TIRUPATI = { lat: 13.6288, lng: 79.4192 };

// Stands in for a browser's open SSE connection.
const writeSSE = vi.fn().mockResolvedValue(undefined);
const stream = { writeSSE } as unknown as SSEStreamingApi;
const feedPings = () => writeSSE.mock.calls.filter(([msg]) => msg.event === "feed").length;

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  subscribe("some-open-browser", stream);
});

afterEach(() => {
  unsubscribe("some-open-browser", stream);
});

function createPost(cookie: string) {
  return authedRequest(app, "/posts", cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Rice and dal for 2",
      pickupLat: TIRUPATI.lat,
      pickupLng: TIRUPATI.lng,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
}

describe("live feed updates", () => {
  it("tells open connections when a post is added, requested and rejected", async () => {
    const poster = await createVerifiedUser(app, { email: "live-poster@example.com" });
    const res = await createPost(poster.cookie);
    expect(res.status).toBe(201);
    const { post } = await res.json();
    expect(feedPings()).toBe(1);

    const picker = await createVerifiedUser(app, { email: "live-picker@example.com" });
    const requestRes = await authedRequest(app, "/requests", picker.cookie, {
      method: "POST",
      body: JSON.stringify({ postId: post.id, pickerName: "Picker", etaMinutes: 15, ...TIRUPATI }),
    });
    expect(requestRes.status).toBe(201);
    const { request } = await requestRes.json();
    expect(feedPings()).toBe(2);

    const reject = await authedRequest(app, `/requests/${request.id}/reject`, poster.cookie, { method: "PUT" });
    expect(reject.status).toBe(200);
    expect(feedPings()).toBe(3);
  });

  it("sends no post data, only a signal to refetch", async () => {
    const poster = await createVerifiedUser(app, { email: "live-data@example.com" });
    await createPost(poster.cookie);

    const [[msg]] = writeSSE.mock.calls.filter(([m]) => m.event === "feed");
    expect(msg.data).toBe("");
  });

  it("stays quiet for a demo visitor's own post", async () => {
    const visitor = await createVerifiedUser(app, { email: "live-demo@example.com" });
    const start = await authedRequest(app, "/auth/demo/start", visitor.cookie, { method: "POST" });
    const demoCookie = start.headers.get("set-cookie")!.split(";")[0];

    const res = await createPost(demoCookie);
    expect(res.status).toBe(201);
    expect(feedPings()).toBe(0);
  });
});
