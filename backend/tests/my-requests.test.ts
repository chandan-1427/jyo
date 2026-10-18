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
import { ownUploadUrl } from "./helpers/uploads.js";

const app = createApp();
const TIRUPATI = { lat: 13.6288, lng: 79.4192 };

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

async function setUp() {
  const poster = await createVerifiedUser(app, { email: "mine-poster@example.com" });
  const picker = await createVerifiedUser(app, { email: "mine-picker@example.com" });
  const photoUrl = ownUploadUrl("food-photos");
  const created = await authedRequest(app, "/posts", poster.cookie, {
    method: "POST",
    body: JSON.stringify({
      title: "Curd rice for 2",
      description: "Made this afternoon",
      photoUrl,
      pickupLat: TIRUPATI.lat,
      pickupLng: TIRUPATI.lng,
      pickupWindowStart: new Date(Date.now() + 60_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
  const { post } = await created.json();
  const requested = await authedRequest(app, "/requests", picker.cookie, {
    method: "POST",
    body: JSON.stringify({ postId: post.id, pickerName: "Picker", etaMinutes: 15, ...TIRUPATI }),
  });
  const { request } = await requested.json();
  return { poster, picker, post, request, photoUrl };
}

describe("GET /requests/mine", () => {
  it("includes enough of each post to show it as a card, but not where it is", async () => {
    const { picker, photoUrl } = await setUp();

    const { requests } = await (await authedRequest(app, "/requests/mine", picker.cookie)).json();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      postTitle: "Curd rice for 2",
      postDescription: "Made this afternoon",
      postPhotoUrl: photoUrl,
      postStatus: "pending_approval",
      status: "pending",
    });
    expect(requests[0].pickupWindowEnd).toBeDefined();
    expect(requests[0]).not.toHaveProperty("pickupLat");
    expect(requests[0]).not.toHaveProperty("pickupLng");
  });
});

describe("GET /posts/:id myRequest", () => {
  it("tells a picker about their own request on the post, and nobody else", async () => {
    const { poster, picker, post, request } = await setUp();

    const forPicker = await (await authedRequest(app, `/posts/${post.id}`, picker.cookie)).json();
    expect(forPicker.myRequest).toMatchObject({ id: request.id, status: "pending" });

    const forPoster = await (await authedRequest(app, `/posts/${post.id}`, poster.cookie)).json();
    expect(forPoster.myRequest).toBeNull();

    const stranger = await createVerifiedUser(app, { email: "mine-stranger@example.com" });
    const forStranger = await (await authedRequest(app, `/posts/${post.id}`, stranger.cookie)).json();
    expect(forStranger.myRequest).toBeNull();
  });
});
