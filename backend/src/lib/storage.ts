import { createClient } from "@supabase/supabase-js";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import crypto from "crypto";
import { env } from "../env.js";
import { logger } from "./logger.js";
import { UploadRejectedError } from "./errors.js";

export type Bucket = "food-photos" | "selfies" | "avatars";

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY // bypasses RLS
);

// Only known-safe image types are accepted (an SVG or HTML file served back
// from our storage would be a stored-XSS payload). The type is detected from
// the file's own bytes via `file-type`, never from the client's
// Content-Type or filename, which anyone can set.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// HEIC ("high efficiency" photos on iPhones and some Android phones) can't be
// decoded by sharp's prebuilt build, and most browsers can't display it
// either. iPhone Safari converts it to JPEG on upload by itself.
const HEIC_MIME_TYPES = new Set(["image/heic", "image/heic-sequence", "image/heif", "image/heif-sequence"]);

// Every image is re-encoded before it's stored:
// - Phone cameras embed metadata, often including the GPS position where the
//   photo was taken. Stored as sent, a food photo would tell anyone who opens
//   the feed exactly where the poster lives, which the app otherwise hides
//   until a request is approved. Re-encoding keeps none of it.
// - Phone photos are several megabytes; the app shows them at most a few
//   hundred pixels wide. 1600px WebP is plenty and a fraction of the size.
const MAX_DIMENSION = 1600;
// Refuses images whose pixel count would take far more memory to decode than
// their file size suggests.
const MAX_INPUT_PIXELS = 50_000_000;

// Every upload is a different image, so sharp's operation cache would only
// hold memory on a small instance.
sharp.cache(false);

// How long browsers and the CDN may keep each upload. Files are never changed
// (each has a new random name), so food photos, seen again and again in the
// feed, keep for a year. Selfies and profile photos are faces: once deleted,
// a cached copy should stop being reachable soon, and they're seen rarely.
const CACHE_SECONDS: Record<Bucket, string> = {
  "food-photos": String(365 * 24 * 60 * 60),
  selfies: "3600",
  avatars: "3600",
};

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// A little above MAX_FILE_SIZE_BYTES to leave room for multipart boundary/
// header overhead — this is the request-level cap checked before the body
// is ever buffered into memory; the real per-file limit is still enforced
// below on the decoded buffer.
export const MAX_UPLOAD_REQUEST_BYTES = MAX_FILE_SIZE_BYTES + 1024 * 1024; // 6 MB

export async function uploadFile(buffer: Buffer, bucket: Bucket): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new UploadRejectedError("File is too large. Maximum size is 5MB.", 413);
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (detected && HEIC_MIME_TYPES.has(detected.mime)) {
    throw new UploadRejectedError(
      "High-efficiency (HEIC) photos can't be used yet. Please choose a JPEG or PNG photo, or switch your camera to the most compatible format.",
      400
    );
  }

  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw new UploadRejectedError(
      "Unsupported or unrecognized file type. Only JPEG, PNG and WEBP images are allowed.",
      400
    );
  }

  let image: Buffer;
  try {
    image = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      // Turn the photo upright first: the orientation is metadata too, and is
      // dropped with the rest.
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new UploadRejectedError("This image couldn't be read. Please try a different photo.", 400);
  }

  const filename = `${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, image, {
      contentType: "image/webp",
      cacheControl: CACHE_SECONDS[bucket],
      upsert: false,
    });

  // Storage's own failure, not the file's: a 500 from app.onError, which
  // reports it. Its message stays in the logs, never in the response.
  if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`);

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return data.publicUrl;
}

// Uploads only ever get a random UUID name with an allowed extension (above).
const UPLOADED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic)$/;

// Shown in the 400's field details; the app always uploads first, so only
// someone calling the API directly with another address ever sees it.
export const FOREIGN_UPLOAD_MESSAGE = "Upload the image through Jyo first, then use the address it returns.";

// Whether a photo or selfie address is one of our own uploads to `bucket`.
// The API takes these as plain URLs, and every viewer's browser loads them.
// An address on someone else's server would let that server log the IP
// address, and so the rough location, of everyone who opens the post or
// request, in an app built around not revealing where people are. The
// prefix comes from the same client that builds upload URLs, so it matches
// them exactly.
export function isOwnUploadUrl(url: string, bucket: Bucket): boolean {
  return uploadNameFromUrl(url, bucket) !== null;
}

// The stored file's name inside `bucket`, if `url` is one of our uploads there.
export function uploadNameFromUrl(url: string, bucket: Bucket): string | null {
  const prefix = supabase.storage.from(bucket).getPublicUrl("x").data.publicUrl.slice(0, -1);
  if (!url.startsWith(prefix)) return null;
  const name = url.slice(prefix.length);
  return UPLOADED_NAME.test(name) ? name : null;
}

export function isUploadName(name: string): boolean {
  return UPLOADED_NAME.test(name);
}

const LIST_PAGE = 1000;

// Every file in `bucket` (uploads are stored flat, with no folders).
export async function listUploads(bucket: Bucket): Promise<{ name: string; createdAt: Date }[]> {
  const files: { name: string; createdAt: Date }[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list("", { limit: LIST_PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Listing ${bucket} failed: ${error.message}`);
    for (const file of data) {
      if (file.id && file.created_at) files.push({ name: file.name, createdAt: new Date(file.created_at) });
    }
    if (data.length < LIST_PAGE) return files;
  }
}

export async function removeUploads(bucket: Bucket, names: string[]): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove(names);
  if (error) throw new Error(`Removing from ${bucket} failed: ${error.message}`);
}

// Best-effort cleanup for when a row referencing an uploaded file is
// deleted outright (as opposed to just changing status) — the file's
// public URL is the only thing we ever stored, so the filename has to be
// recovered from it. Failures are logged, not thrown: a stuck storage
// object is a cheap cleanup job later, but failing the caller's delete
// over it would leave the DB and storage in a worse mismatch than before.
export async function deleteFile(
  publicUrl: string,
  bucket: "food-photos" | "selfies" | "avatars"
): Promise<void> {
  const filename = publicUrl.split("/").pop();
  if (!filename) return;

  const { error } = await supabase.storage.from(bucket).remove([filename]);
  if (error) {
    logger.error({ err: error, bucket, filename }, "Failed to delete storage file");
  }
}
