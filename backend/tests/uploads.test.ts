import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/mailer.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  notifyPoster: vi.fn(),
  notifyPicker: vi.fn(),
}));

// Storage is faked: each test decides whether an upload succeeds or the
// storage service fails, without any network.
const storageUpload = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: storageUpload,
        getPublicUrl: (name: string) => ({ data: { publicUrl: `https://storage.test/${name}` } }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

import { createApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";
import { createVerifiedUser } from "./helpers/auth.js";

const app = createApp();

// The smallest valid PNG: enough for the magic-byte check to recognise it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

function upload(path: string, cookie: string, file?: { bytes: Buffer; type: string }) {
  const form = new FormData();
  if (file) form.append("file", new Blob([file.bytes], { type: file.type }), "photo");
  return app.request(path, { method: "POST", headers: { cookie }, body: form });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  storageUpload.mockResolvedValue({ error: null });
});

describe("photo and selfie uploads", () => {
  it("answers a stored upload with 201 and its address", async () => {
    const user = await createVerifiedUser(app, { email: "uploader@example.com" });

    for (const path of ["/posts/photos", "/requests/selfies"]) {
      const res = await upload(path, user.cookie, { bytes: PNG, type: "image/png" });
      expect(res.status, path).toBe(201);
      expect((await res.json()).url).toMatch(/^https:\/\/storage\.test\/.+\.png$/);
    }
  });

  it("no longer answers at the old upload paths", async () => {
    const user = await createVerifiedUser(app, { email: "old-paths@example.com" });
    for (const path of ["/posts/upload", "/requests/upload-selfie"]) {
      const res = await upload(path, user.cookie, { bytes: PNG, type: "image/png" });
      expect(res.status, path).toBe(404);
    }
  });

  it("rejects a missing file and a file that isn't an allowed image with 400", async () => {
    const user = await createVerifiedUser(app, { email: "bad-file@example.com" });

    expect((await upload("/posts/photos", user.cookie)).status).toBe(400);

    const notImage = await upload("/posts/photos", user.cookie, {
      bytes: Buffer.from("<html>not an image</html>"),
      type: "image/jpeg",
    });
    expect(notImage.status).toBe(400);
    expect((await notImage.json()).error).toMatch(/Unsupported or unrecognized file type/);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  // Regression: storage failing came back as a 400 carrying the provider's
  // own error message, and was never reported.
  it("answers storage failing with a generic 500, not the provider's message", async () => {
    storageUpload.mockResolvedValue({ error: { message: "bucket quota exceeded (internal detail)" } });
    const user = await createVerifiedUser(app, { email: "storage-down@example.com" });

    for (const path of ["/posts/photos", "/requests/selfies", "/users/me/avatar"]) {
      const res = await upload(path, user.cookie, { bytes: PNG, type: "image/png" });
      expect(res.status, path).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Internal server error" });
    }
  });
});
