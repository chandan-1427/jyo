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

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("GET /users/me", () => {
  it("returns the authenticated user's profile", async () => {
    const user = await createVerifiedUser(app, { email: "profile@example.com", name: "Profile Person" });

    const res = await authedRequest(app, "/users/me", user.cookie);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user).toMatchObject({
      id: user.userId,
      name: "Profile Person",
      email: "profile@example.com",
      phone: "9876543210",
    });
  });

  it("rejects an unauthenticated request", async () => {
    const res = await app.request("/users/me");
    expect(res.status).toBe(401);
  });
});

describe("PUT /users/me", () => {
  it("updates the provided fields and leaves others untouched", async () => {
    const user = await createVerifiedUser(app, { email: "editor@example.com" });

    const res = await authedRequest(app, "/users/me", user.cookie, {
      method: "PUT",
      body: JSON.stringify({ locationText: "Balaji Nagar, Tirupati", description: "Student, loves biryani" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.locationText).toBe("Balaji Nagar, Tirupati");
    expect(body.user.description).toBe("Student, loves biryani");
    expect(body.user.email).toBe("editor@example.com"); // untouched

    const reread = await authedRequest(app, "/users/me", user.cookie);
    const rereadBody = await reread.json();
    expect(rereadBody.user.locationText).toBe("Balaji Nagar, Tirupati");
  });

  it("rejects an empty update body", async () => {
    const user = await createVerifiedUser(app, { email: "empty-update@example.com" });
    const res = await authedRequest(app, "/users/me", user.cookie, {
      method: "PUT",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid field value", async () => {
    const user = await createVerifiedUser(app, { email: "invalid-update@example.com" });
    const res = await authedRequest(app, "/users/me", user.cookie, {
      method: "PUT",
      body: JSON.stringify({ name: "a" }), // below min length 2
    });
    expect(res.status).toBe(400);
  });
});
