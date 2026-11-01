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

import sharp from "sharp";
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
      expect((await res.json()).url).toMatch(/^https:\/\/storage\.test\/.+\.webp$/);
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

// What a phone sends: a large JPEG that records where it was taken and that
// the camera was held sideways (orientation 6: rotate 90° to display).
async function phonePhoto() {
  return sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "PhoneMaker", Model: "Phone 12" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "13/1 37/1 4800/100", GPSLongitudeRef: "E", GPSLongitude: "79/1 25/1 1200/100" },
    })
    // sharp writes the orientation only through this option.
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

// The bytes the app handed to storage on the last upload, and the options.
function lastStored() {
  const [, body, options] = storageUpload.mock.calls.at(-1)!;
  return { body: body as Buffer, options: options as { contentType: string; cacheControl: string } };
}

describe("what gets stored", () => {
  it("keeps none of the photo's metadata, so no location leaves the phone", async () => {
    const original = await phonePhoto();
    const before = await sharp(original).metadata();
    expect(before.exif?.includes("PhoneMaker")).toBe(true);
    expect(before.orientation).toBe(6);

    const user = await createVerifiedUser(app, { email: "gps@example.com" });
    expect((await upload("/posts/photos", user.cookie, { bytes: original, type: "image/jpeg" })).status).toBe(201);

    const stored = await sharp(lastStored().body).metadata();
    expect(stored.format).toBe("webp");
    expect(stored.exif).toBeUndefined();
    expect(stored.xmp).toBeUndefined();
    expect(stored.orientation).toBeUndefined();
    expect(lastStored().body.includes("PhoneMaker")).toBe(false);
  });

  it("turns a sideways photo upright and scales it down to 1600px", async () => {
    const user = await createVerifiedUser(app, { email: "resize@example.com" });
    await upload("/posts/photos", user.cookie, { bytes: await phonePhoto(), type: "image/jpeg" });

    const stored = await sharp(lastStored().body).metadata();
    // 4000x3000 held sideways is 3000x4000 upright, scaled to fit 1600.
    expect([stored.width, stored.height]).toEqual([1200, 1600]);
  });

  it("never enlarges a small image", async () => {
    const user = await createVerifiedUser(app, { email: "small@example.com" });
    await upload("/posts/photos", user.cookie, { bytes: PNG, type: "image/png" });
    const stored = await sharp(lastStored().body).metadata();
    expect([stored.width, stored.height]).toEqual([1, 1]);
  });

  it("caches food photos for a year, selfies and profile photos for an hour", async () => {
    const user = await createVerifiedUser(app, { email: "cache@example.com" });

    await upload("/posts/photos", user.cookie, { bytes: PNG, type: "image/png" });
    expect(lastStored().options).toMatchObject({ contentType: "image/webp", cacheControl: "31536000" });

    await upload("/requests/selfies", user.cookie, { bytes: PNG, type: "image/png" });
    expect(lastStored().options.cacheControl).toBe("3600");

    await upload("/users/me/avatar", user.cookie, { bytes: PNG, type: "image/png" });
    expect(lastStored().options.cacheControl).toBe("3600");
  });

  it("refuses a HEIC photo with a message saying what to do", async () => {
    const user = await createVerifiedUser(app, { email: "heic@example.com" });
    // The start of a HEIC file: an ISO-BMFF "ftyp" box with the heic brand.
    const heic = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from("ftypheic"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("mif1heic"),
      Buffer.alloc(64),
    ]);
    const res = await upload("/posts/photos", user.cookie, { bytes: heic, type: "image/heic" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/HEIC/);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("refuses an image it can't decode", async () => {
    const user = await createVerifiedUser(app, { email: "corrupt@example.com" });
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    const res = await upload("/posts/photos", user.cookie, { bytes: corrupt, type: "image/jpeg" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/couldn't be read/);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("refuses an image with far more pixels than any photo", async () => {
    const user = await createVerifiedUser(app, { email: "huge-pixels@example.com" });
    const huge = await sharp({ create: { width: 10000, height: 6000, channels: 3, background: "white" } }).png().toBuffer();
    expect(huge.length).toBeLessThan(5 * 1024 * 1024);

    const res = await upload("/posts/photos", user.cookie, { bytes: huge, type: "image/png" });
    expect(res.status).toBe(400);
    expect(storageUpload).not.toHaveBeenCalled();
  });
});
