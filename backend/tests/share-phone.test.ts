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
const POSTER_PHONE = "9000000001";
const PICKER_PHONE = "9000000002";

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
      pickupWindowEnd: new Date(Date.now() + 3_600_000).toISOString(),
    }),
  });
  return (await res.json()).post.id as string;
}

async function setUp({ pickerShares = false } = {}) {
  const poster = await createVerifiedUser(app, { phone: POSTER_PHONE });
  const picker = await createVerifiedUser(app, { phone: PICKER_PHONE });
  const postId = await newPost(poster.cookie);
  const res = await authedRequest(app, "/requests", picker.cookie, {
    method: "POST",
    body: JSON.stringify({ postId, pickerName: "Picker", etaMinutes: 15, lat: 13.63, lng: 79.42, sharePhone: pickerShares }),
  });
  expect(res.status).toBe(201);
  const requestId = (await res.json()).request.id as string;
  return { poster, picker, postId, requestId };
}

const approve = (cookie: string, requestId: string) =>
  authedRequest(app, `/requests/${requestId}/approve`, cookie, { method: "POST" });
const setSharing = (cookie: string, requestId: string, sharePhone: unknown) =>
  authedRequest(app, `/requests/${requestId}`, cookie, { method: "PATCH", body: JSON.stringify({ sharePhone }) });
const view = async (cookie: string, postId: string) => (await authedRequest(app, `/posts/${postId}`, cookie)).json();

describe("sharing a phone number for a pickup", () => {
  it("shows the picker's number to the poster only once approved, and only if the picker chose to", async () => {
    const { poster, picker, postId, requestId } = await setUp({ pickerShares: true });

    const waiting = await view(poster.cookie, postId);
    expect(waiting.contact).toBeNull();
    expect(JSON.stringify(waiting)).not.toContain(PICKER_PHONE);

    await approve(poster.cookie, requestId);

    expect((await view(poster.cookie, postId)).contact).toEqual({ phone: PICKER_PHONE });
    // The poster didn't choose to share theirs.
    expect((await view(picker.cookie, postId)).contact).toBeNull();
  });

  it("shows the poster's number to the approved picker when the poster opted in", async () => {
    const { poster, picker, postId, requestId } = await setUp();

    const res = await setSharing(poster.cookie, requestId, true);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sharePhone: true });
    expect((await view(poster.cookie, postId)).pendingRequest.sharePhone).toBe(true);

    await approve(poster.cookie, requestId);

    expect((await view(picker.cookie, postId)).contact).toEqual({ phone: POSTER_PHONE });
    expect((await view(poster.cookie, postId)).contact).toBeNull();
  });

  it("lets either side start sharing after approval, and stop", async () => {
    const { poster, picker, postId, requestId } = await setUp();
    await approve(poster.cookie, requestId);

    await setSharing(picker.cookie, requestId, true);
    expect((await view(picker.cookie, postId)).myRequest.sharePhone).toBe(true);
    expect((await view(poster.cookie, postId)).contact).toEqual({ phone: PICKER_PHONE });

    await setSharing(picker.cookie, requestId, false);
    expect((await view(poster.cookie, postId)).contact).toBeNull();
  });

  it("shows the number as it is now, so a corrected one is what the other side gets", async () => {
    const { poster, picker, postId, requestId } = await setUp({ pickerShares: true });
    await approve(poster.cookie, requestId);

    await authedRequest(app, "/users/me", picker.cookie, { method: "PATCH", body: JSON.stringify({ phone: "9111111111" }) });

    expect((await view(poster.cookie, postId)).contact).toEqual({ phone: "9111111111" });
  });

  it("stops showing it once the food is collected or the pickup is called off", async () => {
    const collected = await setUp({ pickerShares: true });
    await approve(collected.poster.cookie, collected.requestId);
    await authedRequest(app, `/posts/${collected.postId}/complete`, collected.poster.cookie, { method: "POST" });
    expect((await view(collected.poster.cookie, collected.postId)).contact).toBeNull();

    const calledOff = await setUp({ pickerShares: true });
    await approve(calledOff.poster.cookie, calledOff.requestId);
    await authedRequest(app, `/posts/${calledOff.postId}/reopen`, calledOff.poster.cookie, { method: "POST" });
    expect((await view(calledOff.poster.cookie, calledOff.postId)).contact).toBeNull();
  });

  it("never shows anyone's number to anyone else, in the post, the feed or request lists", async () => {
    const { poster, postId, requestId } = await setUp({ pickerShares: true });
    await setSharing(poster.cookie, requestId, true);
    await approve(poster.cookie, requestId);
    const stranger = await createVerifiedUser(app, { phone: "9000000003" });

    const pages = [
      await view(stranger.cookie, postId),
      await (await authedRequest(app, "/posts?lat=13.63&lng=79.42", stranger.cookie)).json(),
      await (await authedRequest(app, "/requests/mine", stranger.cookie)).json(),
    ];
    for (const page of pages) {
      const text = JSON.stringify(page);
      expect(text).not.toContain(POSTER_PHONE);
      expect(text).not.toContain(PICKER_PHONE);
    }
  });
});

describe("changing whether you share", () => {
  it("can't be done by someone outside the pickup", async () => {
    const { requestId } = await setUp();
    const stranger = await createVerifiedUser(app);
    expect((await setSharing(stranger.cookie, requestId, true)).status).toBe(403);
  });

  it("is refused once the pickup has ended", async () => {
    const { poster, picker, requestId } = await setUp();
    await authedRequest(app, `/requests/${requestId}/reject`, poster.cookie, { method: "POST" });

    const res = await setSharing(picker.cookie, requestId, true);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("This pickup has already ended");
  });

  it("answers 400 without a true or false, and 404 for a malformed or unknown request", async () => {
    const { picker, requestId } = await setUp();
    expect((await setSharing(picker.cookie, requestId, "yes")).status).toBe(400);
    expect((await setSharing(picker.cookie, "not-a-uuid", true)).status).toBe(404);
    expect((await setSharing(picker.cookie, "00000000-0000-4000-8000-000000000000", true)).status).toBe(404);
  });
});
